const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const {
  post_data,
  update_data,
  specific_data,
  aggregate_data,
} = require("./reuseable_method/resuable_functions");
require("dotenv").config();

const httpStatus = require("http-status");
const { create_token, auth } = require("./jwt_token/create_token");
const { USER_ROLE } = require("./jwt_token/catchAsync");
const {
  connectedDatabase,
  productCategorie,
  userCollection,
  subCategorieCollection,
  categoriesDetailsCollection,
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

    app.post("/api/v1/create_token", async (req, res) => {
      const data = req.body;
      const token = create_token(data);
      res.status(httpStatus.OK).send({
        success: true,
        message: "Successfully create Token",
        data: token,
      });
    });

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
      auth(USER_ROLE.Seller, USER_ROLE.Buyer),
      async (req, res) => {
        const page = Number(req?.query?.page) || 1;
        const limit = Number(req?.query?.limit) || 25;

        const query = [
          {
            $unwind: "$productList", // Deconstruct/breckdown the productList array
          },
          {
            $group: {
              _id: "$categorie_name", // Group documents by categorie_name
              categorieId: { $first: "$_id" },
              count: { $sum: 1 }, // Count the number of products in each category
              products: { $push: "$productList" }, // Accumulate product details for each category
            },
          },
          {
            $sort: {
              count: -1,
            },
          },
        ];

        aggregate_data(query, productCategorie, page, limit)
          .then((result) => {
            return res.send({
              success: true,
              status: httpStatus.OK,
              message: "Successfully Rectrive all Data",
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

    // user Information

    app.post(
      "/api/v1/user_information",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        Reflect.deleteProperty(req.body, process.env.TERM);
        Reflect.deleteProperty(req.body, process.env.CONFIRM_PASSWORD);
        req.body.password = await bcrypt.hash(
          req.body.password,
          Number(process.env.BCRYPT_SALT_ROUNDS)
        );
        const data = { isAdmin: false, ...req.body };

        // checked user  validation/ business logic
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
      }
    );

    // sub categorical product
    //https://www.google.com/search?q=pottery+all+types&sca_esv=1afa8f061832541a&sxsrf=ACQVn0-74u_wLsdpLxVYNS_upLfDYGJk9w%3A1708954126397&ei=DpLcZd_mF8HgseMP05ujiAE&ved=0ahUKEwjfpZCdjsmEAxVBcGwGHdPNCBEQ4dUDCBA&uact=5&oq=pottery+all+types&gs_lp=Egxnd3Mtd2l6LXNlcnAiEXBvdHRlcnkgYWxsIHR5cGVzMgoQABhHGNYEGLADMgoQABhHGNYEGLADMgoQABhHGNYEGLADMgoQABhHGNYEGLADMgoQABhHGNYEGLADMgoQABhHGNYEGLADMgoQABhHGNYEGLADMgoQABhHGNYEGLADSLwPUMkEWKsIcAF4AZABAJgBmwGgAZECqgEDMC4yuAEDyAEA-AEBmAIDoAKfAsICBxAAGIAEGA3CAggQABgIGB4YDcICChAAGAgYHhgNGA_CAgsQABiABBiKBRiGA5gDAOIDBRIBMSBAiAYBkAYIkgcDMS4y&sclient=gws-wiz-serp
    app.post(
      "/api/v1/product_categorie",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const data = req.body;
        data.categorieId = new ObjectId(`${data?.categorieId}`);
        data.productId = new ObjectId(`${data?.productId}`);

        // business logic
        const isExistProduct = await productCategorie
          .findOne({ _id: data.categorieId })
          .then((data) => data?._id);

        if (!isExistProduct) {
          return res.status(httpStatus.NOT_FOUND).send({
            success: false,
            message: "This Categoeis is Not Found",
            status: httpStatus.NOT_FOUND,
          });
        }
        post_data(subCategorieCollection, data)
          .then((result) => {
            return res.status(httpStatus.CREATED).send({
              success: true,
              status: httpStatus.CREATED,
              message: "Successfully Uploaded Your Product",
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
      "/api/v1/get_specificProduct_categories",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        const { categorieId, productId } = req.query;
        const page = Number(req?.query?.page) || 1;
        const limit = Number(req?.query?.limit) || 25;
        const query = [
          {
            $match: {
              categorieId: new ObjectId(categorieId),
              productId: new ObjectId(productId),
            },
          },
        ];

        aggregate_data(query, subCategorieCollection, page, limit)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              status: httpStatus.OK,
              message: "Successfully Uploaded Your Product",
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

    // image details
    app.post(
      "/api/v1/product_details",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const data = req.body;
        const isExistProductSubCategories = await subCategorieCollection
          .findOne({
            productId: new ObjectId(`${data?.productId}`),
          })
          .then((data) => data._id)
          .catch((error) => {
            console.log(error?.message);
          });

        if (!isExistProductSubCategories) {
          return res.status(httpStatus.NOT_FOUND).send({
            success: false,
            message: "This Categoeis is Not Found",
            status: httpStatus.NOT_FOUND,
          });
        }
        // is it exist product deatisl alredy
        const isExistProductDetails = await categoriesDetailsCollection
          ?.findOne({ productId: new ObjectId(`${data?.productId}`) })
          .catch((error) => {
            console.log(error?.message);
          });
        if (isExistProductDetails) {
          return res.status(httpStatus.FOUND).send({
            success: false,
            message: "This Product Details Alredy Exist",
            status: httpStatus.FOUND,
          });
        }

        // image uploding process ----> using cloudnary ---> write a code next time

        // product details uploding process
        data.categorieId = new ObjectId(`${data?.categorieId}`);
        data.productId = new ObjectId(`${data?.productId}`);
        post_data(categoriesDetailsCollection, data)
          .then((result) => {
            return res.status(httpStatus.CREATED).send({
              success: true,
              status: httpStatus.CREATED,
              message: "Successfully Uploaded Product Images",
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

    app.use((req, res, next) => {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ success: false, message: "Server Issurs" });
      next();
    });

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);
