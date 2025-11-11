const expreess=require("express");
const app=expreess();
const mongoose = require('mongoose');
const port=5500;
const Listing=require("./models/listing");
const path=require("path")
const methodOverride = require("method-override");
const ejsMate=require("ejs-mate");
const mongo_url="mongodb://127.0.0.1:27017/wanderlust";

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

app.get("/",(req,res)=>{
    res.send("hii i am root");
})

app.get("/listings",async(req,res)=>{
    const alllistings= await Listing.find({})
    res.render("./listings/index.ejs",{alllistings})
});

app.get("/listings/new",(req,res)=>{
    res.render("./listings/new.ejs")
})

app.post("/listings",async(req,res)=>{
    const newlisting=new Listing(req.body.Listing);
    await newlisting.save();
    res.redirect("/listings")
})

app.get("/listings/:id",async(req,res)=>{
    let {id}=req.params;
    const listing=await Listing.findById(id);
    res.render("./listings/show.ejs",{listing});
});

app.get("/listings/:id/edit",async(req,res)=>{
    let {id}=req.params;
    const listing=await Listing.findById(id);
    res.render("./listings/edit.ejs",{listing})
})

app.put("/listings/:id",async(req,res)=>{
    let {id}=req.params;
    await Listing.findByIdAndUpdate(id,{...req.body.Listing});
    res.redirect(`/listings/${id}`);
})

app.delete("/listings/:id",async(req,res)=>{
    let {id}=req.params;
    await Listing.findByIdAndDelete(id);
    res.redirect("/listings");
})

// app.get("/testListing",async(req,res)=>{
//     let SampleListing=new Listing({
//         title:"my new house",
//         description:"near the river",
//         price:1500,
//         location:"goa",
//         country:"india",
//     });
//     await SampleListing.save();
//     console.log("sample was saved");
//     res.send("successfull")
// })
app.listen(port,()=>{
    console.log(`app listing on port ${port}`);
})