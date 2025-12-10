const expreess=require("express");
const app=expreess();
const mongoose = require('mongoose');
const port=5500;
const { Listing, Cart } = require("./models/listing");
const path=require("path")
const methodOverride = require("method-override");
const ejsMate=require("ejs-mate");
const mongo_url="mongodb://127.0.0.1:27017/akstore";

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(expreess.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.engine('ejs',ejsMate);
app.use(expreess.static(path.join(__dirname,"/public")));

main().then(()=>{
    console.log("connected to DB");
}).catch((err)=>{
    console.log(err);
})
async function main() {
    await mongoose.connect(mongo_url);
}

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

app.get("/",async(req,res)=>{
    //const allproduct= await Listing.find({})
    res.send("i am root goto to /product")
})

app.get("/product",async(req,res)=>{
    const allproduct= await Listing.find({})
    res.render("./listings/index.ejs",{allproduct})
});

app.get("/product/:id",async(req,res)=>{
    let {id}=req.params;
    const product= await Listing.findById(id)
    res.render("./listings/show.ejs",{product})
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
        return res.send(`
            <script>
                alert("Product added to cart successfully!");
                window.history.back();
            </script>
        `);
    } catch (err) {
        console.log(err);
        return res.send(`
            <script>
                alert("Error adding product to cart.");
                window.history.back(); 
            </script>
        `);
    }
});

app.listen(port,()=>{
    console.log(`app listing on port ${port}`);
})