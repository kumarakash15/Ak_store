const expreess=require("express");
const app=expreess();
const mongoose = require('mongoose');
const port=5500;
const Listing=require("./models/listing");
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

app.get("/",async(req,res)=>{
    const allproduct= await Listing.find({})
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

app.listen(port,()=>{
    console.log(`app listing on port ${port}`);
})