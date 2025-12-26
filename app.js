const express = require("express");
const app = express();
const mongoose = require('mongoose');
const port = 5500;
const { Listing, Cart } = require("./models/listing");
const Order = require("./models/order");
const User = require("./models/user");
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");
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

const redirectIfLoggedIn = (req, res, next) => {
  if (req.session.userId) {
    return res.redirect("/product");
  }
  next();
};

app.get("/", wrapAsync(async (req, res) => {
  if (req.session.userId) {
    return res.redirect("/product");
  }
  const allproduct = await Listing.find({});
  res.render("./listings/index.ejs", { allproduct });
}));

app.get("/signup", redirectIfLoggedIn, (req, res) => {
  res.render("./listings/signup.ejs");
});

app.post("/signup", wrapAsync(async (req, res) => {
  const { name, email, mobile, password } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.send(`<script>alert("Email already registered");history.back();</script>`);
  }
  await User.create({
    name,
    email,
    mobile,
    password
  });
  res.redirect("/login");
}));

app.get("/login", redirectIfLoggedIn, (req, res) => {
  res.render("./listings/login.ejs");
});

app.post("/login", wrapAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.password !== password) {
    return res.send(`<script>alert("Invalid credentials");history.back();</script>`);
  }
  req.session.userId = user._id;
  req.session.userName = user.name;
  const redirectUrl = req.session.redirectTo || "/product";
  req.session.redirectTo = null;
  res.redirect(redirectUrl);
}));

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/product", isLoggedIn, wrapAsync(async (req, res) => {
  const allproduct = await Listing.find({});
  res.render("./listings/dashboard.ejs", { allproduct });
}));

app.get("/product/:id", wrapAsync(async (req, res) => {
  let { id } = req.params;
  const product = await Listing.findById(id)
  res.render("./listings/show.ejs", { product })
}))

app.post("/add-to-cart/:id", isLoggedIn, wrapAsync(async (req, res) => {
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
}));

app.get("/cart",isLoggedIn, wrapAsync(async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  const cartItems = await Cart.find({
    userId: req.session.userId
  }).populate("productId");
  res.render("./listings/cart.ejs", { cartItems });
}));

// Increase quantity
app.post("/cart/increase/:id", wrapAsync(async (req, res) => {
  await Cart.findByIdAndUpdate(req.params.id, { $inc: { quantity: 1 } });
  res.sendStatus(200);
}));

// Decrease quantity
app.post("/cart/decrease/:id", wrapAsync(async (req, res) => {
  const item = await Cart.findById(req.params.id);
  if (item.quantity > 1) {
    await Cart.findByIdAndUpdate(req.params.id, { $inc: { quantity: -1 } });
  } else {
    await Cart.findByIdAndDelete(req.params.id);
  }
  res.sendStatus(200);
}));

app.get("/cart/buynow",isLoggedIn, wrapAsync(async (req, res) => {
  const cartItems = await Cart.find({
    userId: req.session.userId
  }).populate("productId");
  if (cartItems.length === 0) return res.redirect("/cart");
  req.session.checkoutItems = cartItems.map(item => ({
    productId: item.productId._id,
    quantity: item.quantity
  }));
  res.render("listings/buynow.ejs", { cartItems });
}));

app.get("/buynow/:id",isLoggedIn, wrapAsync(async (req, res) => {
  const product = await Listing.findById(req.params.id);
  if (!product) return res.redirect("/product");
  req.session.checkoutItems = [{
    productId: product._id,
    quantity: 1
  }];
  const cartItems = [{
    productId: product,
    quantity: 1
  }];
  res.render("listings/buynow.ejs", { cartItems });
}));

app.post("/checkout",isLoggedIn, wrapAsync(async (req, res) => {
    const {
      name, mobile, pincode,
      state, city, locality, house, landmark
    } = req.body;
    const sessionItems = req.session.checkoutItems;
    if (!sessionItems || sessionItems.length === 0) {
      return res.redirect("/cart");
    }
    const simpleOrderId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const order = await Order.create({
      userId: req.session.userId,
      orderId: simpleOrderId,
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
    await Cart.deleteMany({ userId: req.session.userId });
    req.session.checkoutItems = null;
    const populatedOrder = await Order.findById(order._id)
      .populate("items.productId");
    res.render("listings/payment.ejs", { order: populatedOrder });
}));

app.post("/send-otp",isLoggedIn, wrapAsync(async (req, res) => {
  const { mobileNumber, orderId } = req.body;
  if (!mobileNumber || !orderId) {
    return res.status(400).json({
      success: false,
      message: "Mobile number & orderId required"
    });
  }
  const response = await axios.get(
    `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/${mobileNumber}/AUTOGEN`
  );
  req.session.otpData = {
    sessionId: response.data.Details,
    orderId,
    mobile: mobileNumber,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0
  };
  res.json({
    success: true,
    message: "OTP sent successfully"
  });
}));

app.post("/verify-otp",isLoggedIn, wrapAsync(async (req, res) => {
  const { userOtp, orderId } = req.body;
  const otpData = req.session.otpData;

  if (!otpData) {
    return res.json({ success: false, message: "OTP expired" });
  }

  if (otpData.orderId !== orderId) {
    return res.json({ success: false, message: "Invalid OTP request" });
  }

  // 🔐 VERIFY OTP WITH 2FACTOR
  const verifyRes = await axios.get(
    `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/VERIFY/${otpData.sessionId}/${userOtp}`
  );

  if (verifyRes.data.Status !== "Success") {
    return res.json({ success: false, message: "Invalid OTP" });
  }

  // ✅ CONFIRM ORDER (NO SMS)
  const order = await Order.findByIdAndUpdate(
    orderId,
    {
      isVerified: true,
      status: "Confirmed",
      confirmedAt: new Date()
    },
    { new: true }
  ).populate("items.productId");

  if (!order) {
    return res.json({ success: false, message: "Order not found" });
  }

  // 🧹 CLEAR OTP SESSION
  req.session.otpData = null;

  res.json({ success: true });
}));

app.get("/order-success", wrapAsync(async (req, res) => {
  res.render("listings/order-success");
}));

app.get("/order", wrapAsync(async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  const orders = await Order.find({
    userId: req.session.userId
  })
    .populate("items.productId")
    .sort({ orderDate: -1 });

  res.render("listings/order.ejs", { orders });
}));

app.get("/order/:id", wrapAsync(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    userId: req.session.userId
  }).populate("items.productId");
  if (!order) {
    return res.redirect("/order");
  }
  res.render("listings/order-details.ejs", { order });
}));

app.post("/order/:id/cancel", wrapAsync(async (req, res) => {
  const orderId = req.params.id;
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).send("Order not found");
  }
  if (order.status === "Delivered") {
    return res.status(400).send("Order already delivered");
  }
  if (order.status === "Cancelled") {
    return res.status(400).send("Order already cancelled");
  }
  order.status = "Cancelled";
  order.cancelledAt = new Date();
  await order.save();
  res.redirect(`/order/${orderId}`);
}));

app.get("/order/:id/invoice", wrapAsync(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("items.productId");

  if (!order) {
    return res.status(404).send("Order not found");
  }
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=Invoice-${order._id}.pdf`
  );
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);
  doc.fontSize(20).text("AkStore Invoice", { align: "center" }).moveDown();
  doc.fontSize(12).text(`Order ID: ${order._id}`);
  doc.text(`Order Date: ${order.orderDate.toLocaleString()}`);
  doc.text(`Status: ${order.status}`).moveDown();
  doc.fontSize(14).text("Delivery Address:", { underline: true }).moveDown(0.5);
  doc.fontSize(12)
    .text(order.name)
    .text(`${order.house}, ${order.locality}`)
    .text(`${order.city} - ${order.pincode}, ${order.state}`)
    .text(`Mobile: ${order.mobile}`)
    .moveDown();
  let totalAmount = 0;
  doc.fontSize(14).text("Products:", { underline: true }).moveDown(0.5);
  order.items.forEach((item, i) => {
    const price = item.productId.current_price;
    const itemTotal = price * item.quantity;
    totalAmount += itemTotal;
    doc.fontSize(12)
      .text(`${i + 1}. ${item.productId.item_name}`)
      .text(`Qty: ${item.quantity} | ₹${price} | Total ₹${itemTotal}`)
      .moveDown(0.3);
  });
  doc.moveDown().text(`Total Amount: ₹${totalAmount}`, { align: "right" });
  doc.moveDown(2).fontSize(10).text(
    "Thank you for shopping with AkStore!",
    { align: "center" }
  );
  doc.end();
}));

app.use((req, res, next) => {
  next(new ExpressError(404, "Page not found"));
});

app.use((err, req, res, next) => {
  let { status = 500, message = "internal server error!" } = err;
  res.render("./listings/error.ejs", { status, message })
})

app.listen(port, () => {
  console.log(`app listing on port ${port}`);
})