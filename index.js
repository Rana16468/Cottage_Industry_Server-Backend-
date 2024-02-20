const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const {
  post_data,
  update_data,
  get_all_data,
  specific_data,
} = require("./reuseable_method/resuable_functions");
require("dotenv").config();

const httpStatus = require("http-status");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URL
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//https://www.slideshare.net/MdBorhan4/types-of-cottage-industries-in-bangladesh
//

async function run() {
  // Test route
  app.get("/", (req, res) => {
    const serverStatus = {
      message: "Server is running smoothly",
      timestamp: new Date(),
    };
    res.json(serverStatus);
  });

  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("assignment");
    const productCategorie = db.collection("categorie");

    // ==============================================================
    // WRITE YOUR CODE HERE
    // ==============================================================
    app.post("/api/v1/product", async (req, res) => {
      const data = req.body;

      const categories = post_data(productCategorie, data);
      categories
        .then((result) => {
          return res.send({
            success: true,
            message: "Successfully created categorie",
            status: httpStatus.CREATED,
            data: result,
          });
        })
        .catch((error) => {
          return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
            success: false,
            message: error?.message,
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
        });
    });

    app.put("/api/v1/productList/:id", async (req, res) => {
      const { id } = req.params;

      const data = req.body;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $addToSet: { productList: { id: new ObjectId().toString(), ...data } },
      };
      update_data(filter, updateDoc, productCategorie)
        .then((result) => {
          return res.send({
            success: true,
            message: "Successfully  added poduct List",
            status: httpStatus.CREATED,
            data: result,
          });
        })
        .catch((error) => {
          return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
            success: false,
            message: error?.message,
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
        });
    });

    app.get("/api/v1/all_product", async (req, res) => {
      const query = {};

      get_all_data(productCategorie, query)
        .then((result) => {
          return res.send({
            success: true,
            message: "Successfully Get All Product",
            status: httpStatus.OK,
            data: result,
          });
        })
        .catch((error) => {
          return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
            success: false,
            message: error?.message,
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
        });
    });

    app.get("/api/v1/specific_user_product", async (req, res) => {
      const query = req.query;

      specific_data(productCategorie, query)
        .then((result) => {
          return res.send({
            success: true,
            message: "Successfully Get All Product",
            status: httpStatus.OK,
            data: result,
          });
        })
        .catch((error) => {
          return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
            success: false,
            message: error?.message,
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
        });
    });

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);
