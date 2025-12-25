const express = require("express");
const app = express();
const mongoose = require('mongoose');
const port = 5500;
const { Listing, Cart } = require("./models/listing");
const Order = require("./models/order");
const User = require("./models/user");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const axios = require("axios");
const session = require("express-session");
const PDFDocument = require("pdfkit");
const fs = require("fs");
require('dotenv').config();
const cron = require("node-cron");
const qs = require("qs");
const crypto = require('crypto');
const MongoStore = require("connect-mongo").default;
const mongo_url = "mongodb://127.0.0.1:27017/akstore";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

main().then(() => {
  console.log("connected to DB");
}).catch((err) => {
  console.log(err);
})
async function main() {
  await mongoose.connect(mongo_url);
}

app.use(session({
  name: "akstore.sid",
  secret: "akstore",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: mongo_url,
    ttl: 24 * 60 * 60
  }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

// 🕒 AUTO-CANCEL PENDING ORDERS AFTER 10 MINUTES
cron.schedule("*/1 * * * *", async () => {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const result = await Order.updateMany(
      {
        status: "Pending",
        isVerified: false,
        orderDate: { $lt: tenMinutesAgo }
      },
      {
        $set: { status: "Cancelled" }
      }
    );
  } catch (err) {
    console.error("Auto-cancel job error:", err);
  }
});

async function sendSMS(mobile, orderId, totalAmount) {
  try {
    if (!mobile.startsWith("91")) {
      mobile = "91" + mobile;
    }
    const url = `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/ADDON_SERVICES/SEND/TSMS`;

    const payload = qs.stringify({
      From: "AKSTRS",                      // ✅ EXACT Sender ID
      To: mobile,                         // ✅ 91XXXXXXXXXX
      TemplateName: "AK STORE ORDER CONFIRM", // ✅ EXACT template name
      VAR1: orderId,                      // #VAR1#
      VAR2: String(totalAmount)            // #VAR2# (digits only)
    });

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    console.log("SMS API RESPONSE:", response.data);

  } catch (error) {
    console.error(
      "SMS SEND ERROR:",
      error.response?.data || error.message
    );
  }
}

app.use(async (req, res, next) => {
  try {
    if (!req.session.userId) {
      res.locals.cartCount = 0;
      return next();
    }

    const count = await Cart.countDocuments({
      userId: req.session.userId
    });

    res.locals.cartCount = count;
    next();
  } catch (err) {
    console.log("Cart Count Error:", err);
    res.locals.cartCount = 0;
    next();
  }
});

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

app.use((req, res, next) => {
  if (!req.session.userId && req.method === "GET") {
    // Save last visited product page
    if (req.originalUrl.startsWith("/product/")) {
      req.session.redirectTo = req.originalUrl;
    }
  }
  next();
});

const isLoggedIn = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect("/");
  }
  next();
};

app.get("/", async (req, res, next) => {
  try {
    const allproduct = await Listing.find({})
    res.render("./listings/index.ejs", { allproduct })
  }
  catch (err) {
    next(err)
  }
})

app.get("/signup", (req, res) => {
  res.render("./listings/signup.ejs");
});

app.post("/signup", async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.send(`<script>alert("Email already registered");history.back();</script>`);
    }

    await User.create({
      name,
      email,
      mobile,
      password // plain text
    });

    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.send("Signup error");
  }
});

app.get("/login", (req, res) => {
  res.render("./listings/login.ejs");
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.send(`<script>alert("Invalid credentials");history.back();</script>`);
    }

    req.session.userId = user._id;
    req.session.userName = user.name;

    // 🔁 Redirect back if exists
    const redirectUrl = req.session.redirectTo || "/product";
    req.session.redirectTo = null;

    res.redirect(redirectUrl);

  } catch (err) {
    console.error(err);
    res.send("Login error");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/product", isLoggedIn, async (req, res, next) => {
  try {
    const allproduct = await Listing.find({});
    res.render("./listings/dashboard.ejs", { allproduct });
  } catch (err) {
    next(err);
  }
});

app.get("/product/:id", async (req, res) => {
  try {
    let { id } = req.params;
    const product = await Listing.findById(id)
    res.render("./listings/show.ejs", { product })
  }
  catch (err) {
    next(err)
  }
})

app.post("/add-to-cart/:id", isLoggedIn, async (req, res) => {
  try {
    const productId = req.params.id;

    const existingItem = await Cart.findOne({
      productId,
      userId: req.session.userId
    });

    if (existingItem) {
      existingItem.quantity += 1;
      await existingItem.save();
    } else {
      await Cart.create({
        productId,
        userId: req.session.userId
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.get("/cart", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  try {
    const cartItems = await Cart.find({
      userId: req.session.userId
    }).populate("productId");

    res.render("./listings/cart.ejs", { cartItems });
  } catch (err) {
    console.log(err);
    res.send("Error loading cart");
  }
});

// Increase quantity
app.post("/cart/increase/:id", async (req, res, next) => {
  try {
    await Cart.findByIdAndUpdate(req.params.id, { $inc: { quantity: 1 } });
    res.sendStatus(200);
  }
  catch (err) {
    next(err)
  }
});

// Decrease quantity
app.post("/cart/decrease/:id", async (req, res) => {
  const item = await Cart.findById(req.params.id);
  if (item.quantity > 1) {
    await Cart.findByIdAndUpdate(req.params.id, { $inc: { quantity: -1 } });
  } else {
    await Cart.findByIdAndDelete(req.params.id);
  }
  res.sendStatus(200);
});

app.get("/cart/buynow", async (req, res) => {
  const cartItems = await Cart.find({
    userId: req.session.userId
  }).populate("productId");
  if (cartItems.length === 0) return res.redirect("/cart");

  // ✅ save to session
  req.session.checkoutItems = cartItems.map(item => ({
    productId: item.productId._id,
    quantity: item.quantity
  }));

  res.render("listings/buynow.ejs", { cartItems });
});

app.get("/buynow/:id", async (req, res) => {
  const product = await Listing.findById(req.params.id);
  if (!product) return res.redirect("/product");

  // ✅ save single product to session
  req.session.checkoutItems = [{
    productId: product._id,
    quantity: 1
  }];

  const cartItems = [{
    productId: product,
    quantity: 1
  }];

  res.render("listings/buynow.ejs", { cartItems });
});

app.post("/checkout", async (req, res) => {
  try {
    const {
      name, mobile, pincode,
      state, city, locality, house, landmark
    } = req.body;

    // ✅ GET ITEMS FROM SESSION
    const sessionItems = req.session.checkoutItems;

    if (!sessionItems || sessionItems.length === 0) {
      return res.redirect("/cart");
    }

    // ✅ GENERATE A PURELY NUMERIC ORDER ID
    // This is the safest format for DLT compliance.
    const simpleOrderId = Math.floor(1000000000 + Math.random() * 9000000000).toString(); // 10-digit number

    // ✅ CREATE ORDER
    const order = await Order.create({
      userId: req.session.userId,
      orderId: simpleOrderId, // ✅ USE THE NEW NUMERIC ID
      items: sessionItems,
      name,
      mobile,
      pincode,
      state,
      city,
      locality,
      house,
      landmark,
      status: "Pending",
      isVerified: false
    });

    // ✅ CLEAR CART ONLY AFTER ORDER (SAFE)
    await Cart.deleteMany({ userId: req.session.userId });

    // ✅ CLEAR SESSION
    req.session.checkoutItems = null;

    // ✅ POPULATE PRODUCTS
    const populatedOrder = await Order.findById(order._id)
      .populate("items.productId");

    // ✅ RENDER PAYMENT
    res.render("listings/payment.ejs", { order: populatedOrder });
  } catch (err) {
    console.error("CHECKOUT ERROR:", err);
    res.send(`<script>alert("Order failed");history.back();</script>`);
  }
});

app.post("/send-otp", async (req, res) => {
  try {
    const { mobileNumber, orderId } = req.body;

    if (!mobileNumber || !orderId) {
      return res.status(400).json({
        success: false,
        message: "Mobile number & orderId required"
      });
    }

    // 🔐 SEND OTP (AUTOGEN)
    const response = await axios.get(
      `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/${mobileNumber}/AUTOGEN`
    );
    // Save session data
    req.session.otpData = {
      sessionId: response.data.Details, // IMPORTANT
      orderId,
      mobile: mobileNumber,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0
    };
    res.json({
      success: true,
      message: "OTP sent successfully"
    });

  } catch (error) {
    console.error("2FACTOR OTP ERROR:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP"
    });
  }
});

app.post("/verify-otp", async (req, res) => {
  try {
    const { userOtp, orderId } = req.body;
    const otpData = req.session.otpData;

    if (!otpData) {
      return res.json({ success: false, message: "OTP expired" });
    }

    if (otpData.orderId !== orderId) {
      return res.json({ success: false, message: "Invalid OTP request" });
    }
    const verifyRes = await axios.get(
      `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/VERIFY/${otpData.sessionId}/${userOtp}`
    );

    if (verifyRes.data.Status !== "Success") {
      return res.json({ success: false, message: "Invalid OTP" });
    }
    const order = await Order.findByIdAndUpdate(
      orderId, // Still using the _id to find the document
      { isVerified: true, status: "Confirmed" },
      { new: true }
    ).populate("items.productId");
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }
    let totalAmount = 0;
    for (const item of order.items) {
      totalAmount += item.productId.current_price * item.quantity;
    }
    totalAmount = Math.round(totalAmount);
    await sendSMS(
      otpData.mobile,
      order.orderId,          
      totalAmount
    );
    req.session.otpData = null;

    console.log(`SMS sent to: ${otpData.mobile} for Order ID: ${order.orderId}`);
    res.json({ success: true });

  } catch (error) {
    console.error(
      "VERIFY OTP ERROR:",
      error.response?.data || error.message
    );
    res.json({ success: false, message: "Verification failed" });
  }
});

app.get("/order-success", async (req, res) => {
  res.render("listings/order-success");
});

app.get("/order", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  try {
    const orders = await Order.find({
      userId: req.session.userId
    })
      .populate("items.productId")
      .sort({ orderDate: -1 });

    res.render("listings/order.ejs", { orders });

  } catch (err) {
    console.error(err);
    res.send("Error loading orders");
  }
});

app.get("/order/:id", async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      userId: req.session.userId // ✅ SECURITY CHECK
    }).populate("items.productId");

    if (!order) return res.redirect("/order");

    res.render("listings/order-details.ejs", { order });

  } catch (err) {
    console.error(err);
    res.redirect("/order");
  }
});

app.post("/order/:id/cancel", async (req, res) => {
  try {
    const orderId = req.params.id;

    // Fetch order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send("Order not found");
    }

    // Check if order is already Delivered or Cancelled
    if (order.status === "Delivered") {
      return res.status(400).send("Order has already been delivered and cannot be cancelled");
    }
    if (order.status === "Cancelled") {
      return res.status(400).send("Order is already cancelled");
    }

    // Update order status
    order.status = "Cancelled";
    order.cancelledAt = new Date();

    await order.save();

    // Redirect back to order details page
    res.redirect(`/order/${orderId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/order/:id/invoice", async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate("items.productId");
    if (!order) {
      return res.status(404).send("Order not found");
    }
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    // Set response headers
    res.setHeader("Content-Disposition", `attachment; filename=Invoice-${order._id}.pdf`);
    res.setHeader("Content-Type", "application/pdf");

    // Pipe PDF to response
    doc.pipe(res);

    // ====== Header ======
    doc
      .fontSize(20)
      .text("AkStore Invoice", { align: "center" })
      .moveDown();

    doc.fontSize(12).text(`Order ID: ${order._id}`);
    doc.text(`Order Date: ${order.orderDate.toLocaleString()}`);
    doc.text(`Status: ${order.status}`);
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.moveDown();

    // ====== Delivery Address ======
    doc.fontSize(14).text("Delivery Address:", { underline: true }).moveDown(0.5);
    doc.fontSize(12)
      .text(`${order.name}`)
      .text(`${order.house}, ${order.locality}`)
      .text(`${order.city} - ${order.pincode}, ${order.state}`)
      .text(`Mobile: ${order.mobile}`)
      .moveDown();

    // ====== Products Table ======
    doc.fontSize(14).text("Products:", { underline: true }).moveDown(0.5);

    let totalAmount = 0;
    order.items.forEach((item, index) => {
      if (item.productId) {
        const product = item.productId;
        const itemTotal = product.current_price * item.quantity;
        totalAmount += itemTotal;

        doc
          .fontSize(12)
          .text(`${index + 1}. ${product.item_name} (${product.company})`)
          .text(`   Quantity: ${item.quantity} | Price: ₹${product.current_price} | Total: ₹${itemTotal}`)
          .moveDown(0.5);
      }
    });

    doc.moveDown().fontSize(12).text(`Total Amount (COD): ₹${totalAmount}`, { align: "right" });

    // ====== Footer ======
    doc.moveDown(2)
      .fontSize(10)
      .text("Thank you for shopping with AkStore!", { align: "center" });

    // Finalize PDF
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`app listing on port ${port}`);
})