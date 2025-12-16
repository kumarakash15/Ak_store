const express = require("express");
const app = express();
const mongoose = require('mongoose');
const port = 5500;
const { Listing, Cart } = require("./models/listing");
const Order = require("./models/order");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const axios = require("axios");
const session = require("express-session");
require('dotenv').config();
const cron = require("node-cron");
const mongo_url = "mongodb://127.0.0.1:27017/akstore";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));
app.use(session({
    secret: "akstore",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 10 * 60 * 1000 }
}));

main().then(() => {
    console.log("connected to DB");
}).catch((err) => {
    console.log(err);
})
async function main() {
    await mongoose.connect(mongo_url);
}
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
        const count = await Cart.countDocuments();
        res.locals.cartCount = count;
        next();
    } catch (err) {
        console.log("Cart Count Error:", err);
        res.locals.cartCount = 0;
        next();
    }
});

app.get("/", async (req, res) => {
    const allproduct= await Listing.find({})
    res.render("./listings/index.ejs", { allproduct })
})

app.get("/product", async (req, res) => {
    const allproduct = await Listing.find({})
    res.render("./listings/dashboard.ejs", { allproduct })
});

app.get("/product/:id", async (req, res) => {
    let { id } = req.params;
    const product = await Listing.findById(id)
    res.render("./listings/show.ejs", { product })
})

app.post("/add-to-cart/:id", async (req, res) => {
    try {
        const productId = req.params.id;
        const existingItem = await Cart.findOne({ productId });
        if (existingItem) {
            existingItem.quantity += 1;
            await existingItem.save();
        } else {
            await Cart.create({ productId });
        }
        res.json({ success: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false });
    }
});

app.get("/cart", async (req, res) => {
    try {
        const cartItems = await Cart.find().populate("productId");
        res.render("./listings/cart.ejs", { cartItems });
    } catch (err) {
        console.log(err);
        res.send("Error loading cart");
    }
});

// Increase quantity
app.post("/cart/increase/:id", async (req, res) => {
    await Cart.findByIdAndUpdate(req.params.id, { $inc: { quantity: 1 } });
    res.sendStatus(200);
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
  const cartItems = await Cart.find().populate("productId");

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

    // ✅ CREATE ORDER
    const order = await Order.create({
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
    await Cart.deleteMany({});

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

    // VERIFY WITH 2FACTOR
    const verifyRes = await axios.get(
      `https://2factor.in/API/V1/${process.env.TWO_FACTOR_API_KEY}/SMS/VERIFY/${otpData.sessionId}/${userOtp}`
    );

    if (verifyRes.data.Status !== "Success") {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    // ✅ OTP SUCCESS → CONFIRM ORDER
    await Order.findByIdAndUpdate(orderId, {
      isVerified: true,
      status: "Confirmed"
    });

    req.session.otpData = null;

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Verification failed" });
  }
});

app.get("/order-success", async (req, res) => {
  res.render("listings/order-success");
});

app.get("/order", async (req, res) => {
    try {
        const orders = await Order.find().populate("items.productId").sort({ orderDate: -1 });
        res.render("listings/order.ejs", { orders });
    } catch (err) {
        console.error(err);
        res.send("Error loading orders");
    }
});

app.listen(port, () => {
    console.log(`app listing on port ${port}`);
})