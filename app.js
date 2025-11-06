const expreess=require("express");
const app=expreess();
const mongoose = require('mongoose');
const port=5500;
const mongo_url="mongodb://127.0.0.1:27017/wanderlust";
const Listing=require("./models/listing");
main().then(()=>{
    console.log("connected to DB");
}).catch((err)=>{
    console.log(err);
})
async function main() {
    await mongoose.connect(mongo_url);
}

app.get("/",(req,res)=>{
    res.send("hii i am root")
})
app.listen(port,()=>{
    console.log(`app listing on port ${port}`);
})