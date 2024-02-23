const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const {
  post_data,
  update_data,
  get_all_data,
  specific_data,
} = require("./reuseable_method/resuable_functions");
require("dotenv").config();

const httpStatus = require("http-status");
const { create_token, auth } = require("./jwt_token/create_token");
const { USER_ROLE } = require("./jwt_token/catchAsync");
const {
  connectedDatabase,
  productCategorie,
  userCollection,
} = require("./DB/mongoDB");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URL

connectedDatabase().catch((error) =>
  console.dir(error?.message + "mongodb error")
);

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

    app.get(
      "/api/v1/all_product",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
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
      }
    );

    app.get(
      "/api/v1/specific_user_product",
      auth(USER_ROLE.Seller),
      async (req, res) => {
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
      }
    );

    app.post("/api/v1/create_token", async (req, res) => {
      const data = req.body;
      const token = create_token(data);
      res.status(httpStatus.OK).send({
        success: true,
        message: "Successfully create Token",
        data: token,
      });
    });

    // user Information

    app.post("/api/v1/user_information", async (req, res) => {
      Reflect.deleteProperty(req.body, process.env.TERM);
      Reflect.deleteProperty(req.body, process.env.CONFIRM_PASSWORD);
      req.body.password = await bcrypt.hash(
        req.body.password,
        Number(process.env.BCRYPT_SALT_ROUNDS)
      );
      const data = { isAdmin: false, ...req.body };

      // checked user  validation
      const isUserExist = await userCollection
        .findOne({ email: req.body.email })
        .then((data) => data?._id);

      if (isUserExist) {
        return res.status(httpStatus.ALREADY_REPORTED).send({
          success: false,
          message: "User Already Exist",
          status: httpStatus.ALREADY_REPORTED,
        });
      }

      post_data(userCollection, data)
        .then((result) => {
          return res.status(httpStatus.CREATED).send({
            success: true,
            status: httpStatus.CREATED,
            message: "Successfully Recorded Information",
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
