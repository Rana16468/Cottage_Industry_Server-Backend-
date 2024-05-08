const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const SSLCommerzPayment = require("sslcommerz-lts");
const Replicate = require("replicate");
const {
  post_data,
  update_data,

  aggregate_data,
  get_all_data,
  delete_data,
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
  subCategorieCollection,
  categoriesDetailsCollection,
  chatbotCollection,
  addToCardCollection,
  client,
  paymentCollection,
  reviewCollection,
  wishlistCollection,
  reportCollection,
} = require("./DB/mongoDB");
const {
  upload,
  sendImageToCloudinary,
} = require("./reuseable_method/ImageGenarator");
const { paymentGetWay } = require("./reuseable_method/paymentGetWay");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

//ssl commerz functionality
const store_id = process.env.STORE_ID;
const store_password = process.env.STORE_PASSWORD;
const is_live = false; //true for live, false for sandbox

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

    app.post("/api/v1/product", auth(USER_ROLE.Seller), async (req, res) => {
      // validation Checking
      const { email } = req.user;

      const isExistCategorie = await productCategorie
        .findOne({ email, categorie_name: req.body.categorie_name })
        .then((data) => data?._id);

      if (isExistCategorie) {
        return res.status(httpStatus.FOUND).send({
          success: true,
          message: "This Categories Alredy Exist",
          status: httpStatus.FOUND,
        });
      }

      const categories = post_data(productCategorie, req.body);
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

    app.put(
      "/api/v1/productList/:id",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const { id } = req.params;

        const data = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $addToSet: {
            productList: { id: new ObjectId().toString(), ...data },
          },
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
      }
    );

    app.get(
      "/api/v1/all_product",
      auth(USER_ROLE.Seller, USER_ROLE.Buyer),
      async (req, res) => {
        const page = Number(req?.query?.page) || 1; // page --->
        const limit = Number(req?.query?.limit) || 25;
        const user = req.user;
        // if is it Admin or not
        const projection = { isAdmin: 1, _id: 0 };
        const isAdmin = await userCollection.findOne(
          { email: user?.email },
          { projection }
        );

        // condition
        let query;
        if (user.role === "seller" && !isAdmin?.isAdmin) {
          query = [
            {
              $match: { email: user.email },
            },
            {
              $unwind: "$productList", // Deconstruct/breckdown the productList array
            },
            {
              $group: {
                _id: "$_id", // Group documents by categorie_name
                categorieId: { $first: "$categorie_name" },
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
        } else {
          query = [
            {
              $unwind: "$productList", // Deconstruct/breckdown the productList array
            },
            {
              $group: {
                _id: "$_id", // Group documents by categorie_name
                categorieId: { $first: "$categorie_name" },
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
        }

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

    // get Speciidc Categorical Product
    app.get(
      "/api/v1/specific_categorical_product",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        const result = await productCategorie.find(req.query).toArray();
        res.status(httpStatus.OK).send({
          success: true,
          status: httpStatus.OK,
          message: "Get Successfully",
          data: result,
        });
      }
    );

    // get all specific seller  categoriesal data

    app.get(
      "/api/v1/specific_user_product",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const page = Number(req?.query?.page) || 1;
        const limit = Number(req?.query?.limit) || 25;

        const { email } = req.user;

        const projection = { isAdmin: 1, _id: 0 };
        const isAdmin = await userCollection.findOne({ email }, { projection });

        let query;
        if (isAdmin.isAdmin) {
          query = [];
        } else {
          query = [
            {
              $match: { email },
            },
          ];
        }

        aggregate_data(query, productCategorie, page, limit)
          .then((result) => {
            return res.send({
              success: true,
              status: httpStatus.OK,
              message: "Successfully Rectrive Specific Seller Data",
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

    // delete categorie
    app.delete(
      "/api/v1/delete_categorie",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const { id } = req.query;
        const query = {
          categorieId: new ObjectId(`${id}`),
        };
        const isExistSubCategorie = await subCategorieCollection
          .findOne(query)
          .then((data) => data?._id);

        if (isExistSubCategorie) {
          return res.status(httpStatus.FOUND).send({
            success: true,
            status: httpStatus.FOUND,
            message: "You Can't Deleted",
          });
        }
        delete_data(id, productCategorie)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              status: httpStatus.OK,
              message: "Successfully Deleted",
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

    // update categorie

    app.put(
      "/api/v1/update_categorie/:id",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const { id } = req.params;
        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: req.body,
        };
        update_data(filter, updateDoc, productCategorie)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              status: httpStatus.OK,
              message: "Update Categories Successfully",
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

      async (req, res) => {
        // checked user alredy exist or not
        const isExistUser = await userCollection
          .findOne({ email: req.body.email })
          .then((data) => data?._id);
        if (isExistUser) {
          return res.status(httpStatus.CREATED).send({
            success: true,
            status: httpStatus.CREATED,
            message: "User Information Alredy exist",
          });
        }
        Reflect.deleteProperty(req.body, process.env.TERM);
        Reflect.deleteProperty(req.body, process.env.CONFIRM_PASSWORD);
        req.body.password = await bcrypt.hash(
          req.body.password,
          Number(process.env.BCRYPT_SALT_ROUNDS)
        );
        const data = { isAdmin: false, ...req.body };

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

    // only seller user display

    app.get(
      "/api/v1/buyer_specific_subcategore",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        const query = {
          name: req.query.subDetails,
        };

        const { role, email } = req.user;
        let result;
        if (role === process.env.buyer_account) {
          result = await subCategorieCollection.find(query).toArray();
        } else {
          const specificUserProduct = await productCategorie
            .find({ email })
            .project({ productList: 1 })
            .toArray();
          const subCategorieProductId = specificUserProduct
            ?.map((v) =>
              v?.productList?.find(
                (v) => v?.tittle === req.query.subCategorieName
              )
            )
            .reduce((acc, val) => {
              if (val !== undefined) {
                acc.push(val);
              }
              return acc;
            }, []);
          if (
            Array.isArray(subCategorieProductId) &&
            subCategorieProductId.length === 0
          ) {
            return res.status(httpStatus.OK).send({
              success: true,
              status: httpStatus.OK,
              message: " Subcategorie Data Not Exist ",
            });
          }

          const subQuery = {
            productId: new ObjectId(`${subCategorieProductId[0].id}`),
          };

          result = await subCategorieCollection.find(subQuery).toArray();
        }

        res.status(httpStatus.OK).send({
          success: true,
          status: httpStatus.OK,
          message: "Successfully Get All Subcategorie",
          data: result,
        });
      }
    );

    // image details
    app.post(
      "/api/v1/product_details",
      auth(USER_ROLE.Seller),
      upload.array("photo"),
      async (req, res) => {
        const { formData } = req.body; // text data
        const data = JSON.parse(formData);
        // checked --- business logic  // sub categorie exist or not
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
          ?.findOne({ SubcategorieId: new ObjectId(`${data?.SubcategorieId}`) })
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
        const randomNumber = Math.floor(Math.random() * 100) + 1; //random number geberator
        const imgName = "image";
        const uploadPromises = req.files.map(async (file, index) => {
          const imageName = `${imgName.trim()}${randomNumber + index + 1}`;
          const imageUrl = await sendImageToCloudinary(imageName, file.path);
          return imageUrl?.secure_url;
        });

        try {
          const imageList = await Promise.all(uploadPromises);
          // product details uploding process
          if (!imageList?.length) {
            return res.status(httpStatus.NOT_FOUND).send({
              success: false,
              message: "Cloudenery Issues Image Not Uploding",
              status: httpStatus.NOT_FOUND,
            });
          }
          const SubcategorieId = new ObjectId(`${data?.SubcategorieId}`);
          const productId = new ObjectId(`${data?.productId}`);
          const postData = {
            SubcategorieId,
            productId,
            imageList,
          };

          const isDetails = await subCategorieCollection.updateOne(
            { _id: SubcategorieId },
            {
              $set: {
                isDetails: true,
              },
            },
            { upsert: true }
          );
          if (!isDetails) {
            return res.status(httpStatus.NOT_FOUND).send({
              success: false,
              message: "Issues By the is Details",
              status: httpStatus?.NOT_FOUND,
            });
          }

          post_data(categoriesDetailsCollection, postData)
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
        } catch (error) {
          return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
            success: false,
            message: error?.message,
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
        }
      }
    );

    // specific product product details

    app.get(
      "/api/v1/specific_product_details",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        const { productId, SubcategorieId } = req?.query;

        const query = [
          // statge 1
          {
            $match: {
              productId: new ObjectId(productId),

              SubcategorieId: new ObjectId(SubcategorieId),
            },
          },
          // statge 2
          {
            $lookup: {
              from: "subcategorie",
              localField: "SubcategorieId",
              foreignField: "_id",
              as: "categorie",
            },
          },
        ];

        aggregate_data(
          query,
          categoriesDetailsCollection,
          (limit = 1),
          (page = 1)
        )
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              status: httpStatus.OK,
              message: "Successfully Rectrive Details",
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

    // messanger
    app.patch("/api/v1/message", auth(USER_ROLE.Buyer), async (req, res) => {
      const { email } = req.user;

      req.body.DetailsId = new ObjectId(`${req.body.DetailsId}`);
      // state 1---> validation checking done
      const isExistSubCategorie = await categoriesDetailsCollection
        .findOne({ _id: req.body.DetailsId })
        .then((data) => data?._id)
        .catch((error) => {
          throw new Error(error?.message);
        });

      if (!isExistSubCategorie) {
        return res.status(httpStatus.NOT_FOUND).send({
          success: false,
          message: "This Product Details Not Exist",
          status: httpStatus.NOT_EXTENDED,
        });
      }

      //  state -3  store database message details
      const filter = { email, DetailsId: req.body.DetailsId };
      const updateDoc = {
        $push: {
          queries: {
            messageId: new ObjectId().toString(),
            message: req.body.message,
            reply: [],
          },
        },
      };

      update_data(filter, updateDoc, chatbotCollection)
        .then((result) => {
          return res.send({
            success: true,
            message: "Send Message Successfully",
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

    app.patch("/api/v1/reply", auth(USER_ROLE.Seller), async (req, res) => {
      const filter = {
        _id: new ObjectId(`${req.body.chatId}`),
        "queries.messageId": req.body.messageId,
      };
      const updateDoc = {
        $push: { "queries.$.reply": { replymessage: req.body.replymessage } },
      };

      update_data(filter, updateDoc, chatbotCollection)
        .then((result) => {
          return res.send({
            success: true,
            message: "reply message successfuly recorded",
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

    // get user message and replay message both end (buyer and seller)
    app.get(
      "/api/v1/display_chatting_message/:productDetailsId",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        const { productDetailsId } = req.params;
        const { email } = req.user;
        const query = [
          {
            $match: {
              DetailsId: new ObjectId(productDetailsId),
              email,
            },
          },
        ];

        aggregate_data(query, chatbotCollection, (page = 1), (limit = 500))
          .then((result) => {
            return res.send({
              success: true,
              message: "Successfully Get Specific Product Caht",
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

    // update chatting message from buyer

    app.patch(
      "/api/v1/update_chatting_message",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        const { _id, messageId, message } = req.body;
        const filter = {
          _id: new ObjectId(`${_id}`),
          "queries.messageId": messageId,
        };

        const updateDoc = {
          $set: { "queries.$.message": message },
        };
        update_data(filter, updateDoc, chatbotCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfully Update",
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

    // delete chatbot message

    app.patch(
      "/api/v1/delete_chettingMessage",
      auth(USER_ROLE.Buyer),
      async (req, res) => {
        const { _id, messageId } = req.body;
        const filter = {
          _id: new ObjectId(`${_id}`),
          "queries.messageId": messageId,
        };
        const updateDoc = {
          $unset: { "queries.$.message": "" },
        };

        update_data(filter, updateDoc, chatbotCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Delete Successfully",
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

    // reply message --> get Buyer message

    app.get(
      "/api/v1/display_specific_product_chat/:DetailsId",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const query = {
          DetailsId: new ObjectId(req.params.DetailsId),
        };

        get_all_data(chatbotCollection, query)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfuly Get Speciific Product Message",
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

    // seller end --- update reply message

    app.patch(
      "/api/v1/update_reply_message",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const { _id, messageId, index, replymessage } = req.body;
        const filter = {
          _id: new ObjectId(`${_id}`),
          "queries.messageId": messageId,
        };

        const updaetDoc = {
          $set: {
            [`queries.$.reply.${index}`]: { replymessage },
          },
        };

        update_data(filter, updaetDoc, chatbotCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfully Update Reply Message",
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

    // seller end delete reply message
    app.patch(
      "/api/v1/delete_reply_message",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const { _id, messageId, index } = req.body;
        const filter = {
          _id: new ObjectId(`${_id}`),
          "queries.messageId": messageId,
        };

        const updateDoc = {
          $unset: {
            [`queries.$.reply.${index}`]: { $exists: true },
          },
        };

        update_data(filter, updateDoc, chatbotCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfully Deleted Reply Message",
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
    // update sub categorial data

    app.put(
      "/api/v1/update_sub_categorie/:id",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const { id } = req.params;
        const data = req.body;

        // checked user validation code needed  --> business logics

        const filter = {
          _id: new ObjectId(id),
        };
        const updateDoc = {
          $set: data,
        };

        update_data(filter, updateDoc, subCategorieCollection)
          .then((result) => {
            return res.send({
              success: true,
              message: "Sub Categorical Data Update Successfully",
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

    // update image details
    app.put(
      "/api/v1/update_image_details/:id",
      auth(USER_ROLE.Seller),

      async (req, res) => {
        const { id } = req.params;
        const filter = { _id: new ObjectId(id) };
        const data = req.body;

        const updateDoc = {
          $set: { [`imageList.${data.indexToUpdate}`]: data.newImageUrl },
        };

        update_data(filter, updateDoc, categoriesDetailsCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Details Image Update Successfully",
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

    // delete image details

    app.put("/api/v1/deleteImageDetails/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $pull: { imageList: { $eq: req.body.image } },
      };

      update_data(filter, updateDoc, categoriesDetailsCollection)
        .then((result) => {
          return res.status(httpStatus.OK).send({
            success: true,
            message: "Delete Successfully",
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

    //started the journey add to Card Product Started

    app.post(
      "/api/v1/addToCard_Product",
      auth(USER_ROLE.Buyer),
      async (req, res) => {
        const { email } = req.user;
        const subcategorieId = new ObjectId(`${req.body.id}`);

        // checked alresy exist this product into my card

        const isExistSubcategorieId = await addToCardCollection
          .findOne({ subcategorieId })
          .then((data) => data?._id);

        if (isExistSubcategorieId) {
          return res.status(httpStatus.FOUND).send({
            success: true,
            message: "Already Exist",
            status: httpStatus.FOUND,
          });
        }

        const addToCard = {
          subcategorieId,
          email,
          status: false,
          count: 0,
          ...req.body,
        };
        Reflect.deleteProperty(addToCard, "id");

        post_data(addToCardCollection, addToCard)
          .then((result) => {
            return res.status(httpStatus.CREATED).send({
              success: true,
              message: "Successfuly Added Product",
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
      }
    );

    app.get(
      "/api/v1/my_addToCard_product",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        const user = req.user;
        let query;
        if (user.role === process.env.buyer_account) {
          query = {
            email: user.email,
          };
        } else {
          query = {};
        }
        get_all_data(addToCardCollection, query, (page = 1), (limit = 50))
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfully Get My Product",
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

    app.patch(
      `/api/v1/add_to_product_count/:id`,
      auth(USER_ROLE.Buyer),
      async (req, res) => {
        const { id } = req.params;
        const filter = {
          _id: new ObjectId(id),
        };
        const addToCardFilter = {
          subcategorieId: new ObjectId(id),
          email: req.user.email,
        };
        const updateDoc = {
          $set: { count: req.body.count },
        };

        //console.log(req.body);
        const isExistProduct = await subCategorieCollection.findOne(filter, {
          projection: { quentity: 1 },
        });

        if (isExistProduct?.quentity - 1 <= 0) {
          return res.status(httpStatus.FORBIDDEN).send({
            success: true,
            status: httpStatus.FORBIDDEN,
            message: "Your Product Quantity Ended",
          });
        }

        //console.log(isExistProduct);
        const session = client.startSession();
        try {
          session.startTransaction();
          // const newQuantity = isExistProduct?.quentity - req.body.count;
          const newQuantity =
            req.body.condition === process.env.CONDITION_INCREMENT
              ? isExistProduct?.quentity - 1
              : isExistProduct?.quentity + 1;

          //proble or issues

          const updateQuentity = await subCategorieCollection.updateOne(
            filter,
            { $set: { quentity: newQuantity } },
            { upsert: true, session }
          );

          if (!updateQuentity.modifiedCount > 1) {
            throw new Error("Session is Faield Sub Categories Collextion");
          }

          const updateAddToCard = await addToCardCollection.updateOne(
            addToCardFilter,
            updateDoc,
            { upsert: true, session }
          );

          if (!updateAddToCard.modifiedCount > 1) {
            throw new Error("Session is Faield Add To Card  Collextion");
          }
          await session.commitTransaction();
          await session.endSession();
          return res.status(httpStatus.OK).send({
            success: true,
            message: "Successfully Get My Product",
            status: httpStatus.OK,
            data: updateAddToCard,
          });
        } catch (error) {
          await session.abortTransaction();
          await session.endSession();
        }
      }
    );

    // delete add to card product

    app.delete(
      "/api/v1/delete_add_to_cardItem/:id",
      auth(USER_ROLE.Buyer),
      async (req, res) => {
        const filter = {
          _id: new ObjectId(`${req.body.subcategorieId}`),
        };

        const deleteFilte = {
          _id: new ObjectId(req.params.id),
          email: req.body.email,
        };

        // checked is payment completed or not
        const query = {
          subcategorieId: new ObjectId(`${req.body.subcategorieId}`),
          email: req.user.email,
        };

        const isPaymentCompleted = await addToCardCollection.findOne(query, {
          projection: { status: 1 },
        });

        const specificProduct = await subCategorieCollection.findOne(filter);
        let newQuentity;
        if (!isPaymentCompleted.status) {
          newQuentity = specificProduct.quentity + req.body.count;
        } else {
          newQuentity = specificProduct.quentity;
        }

        // start Transaction Roll Back
        const session = client.startSession();
        try {
          session.startTransaction();
          const updateQuentity = await subCategorieCollection.updateOne(
            filter,
            { $set: { quentity: newQuentity } },
            { upsert: true, session }
          );
          if (!updateQuentity.modifiedCount > 1) {
            throw new Error("Session is Faield Sub Categories Collection");
          }

          const deleteAddToCard = await addToCardCollection.deleteOne(
            deleteFilte,
            {
              session,
            }
          );
          if (!deleteAddToCard.deletedCount > 1) {
            throw new Error("Session is Faield Delete Add To Card Collection");
          }
          await session.commitTransaction();
          await session.endSession();
          return res.status(httpStatus.OK).send({
            success: true,
            message: "Successfully Deleted",
            status: httpStatus.OK,
            data: deleteAddToCard,
          });
        } catch (error) {
          await session.abortTransaction();
          await session.endSession();
        }
      }
    );

    // order summary
    app.post("/api/v1/order", auth(USER_ROLE.Buyer), async (req, res) => {
      const tran_id = new Date().getTime();
      const productData = req.body;
      const data = paymentGetWay(productData, tran_id);

      //product Id;
      var purchaseProductId = productData.productId.map(
        (id) => new ObjectId(`${id}`)
      );

      const sslcz = new SSLCommerzPayment(store_id, store_password, is_live);

      // store database ---->  transactionID
      const finalOrder = {
        ...productData,
        paidStatus: false,
        transactionID: tran_id,
      };

      finalOrder.date = new Date(productData.data);
      // transaction Rollback
      const session = client.startSession();
      try {
        session.startTransaction();
        const paymentInfo = await paymentCollection.insertOne(
          finalOrder,
          session
        );
        if (!paymentInfo.acknowledged) {
          throw new Error("Failed Payment Information Session");
        }
        const addedPaymentStatus = await addToCardCollection.updateMany(
          { _id: { $in: purchaseProductId } },
          { $set: { status: true } },
          { upsert: true },
          { session }
        );

        if (addedPaymentStatus.modifiedCount > 1) {
          throw new Error("Session is Faield Add To Card  Collection");
        }
        await session.commitTransaction();
        await session.endSession();

        sslcz.init(data).then((apiResponse) => {
          // Redirect the user to payment gateway
          let GatewayPageURL = apiResponse.GatewayPageURL;

          res.send({ url: GatewayPageURL });
          //  console.log('Redirecting to: ', GatewayPageURL)
        });
      } catch (error) {
        await session.abortTransaction();
        await session.endSession();
      }
    });

    app.post("/api/v1/payment/success/:tranId", async (req, res) => {
      const tranId = req.params.tranId;
      const filter = {
        transactionID: Number(tranId),
      };
      const updateDoc = {
        $set: {
          paidStatus: true,
        },
      };
      let session; // Declare session outside try-catch block

      try {
        session = client.startSession();
        session.startTransaction();

        const paymentSuccess = await paymentCollection.updateOne(
          filter,
          updateDoc,
          { session }
        );

        if (paymentSuccess.modifiedCount <= 0) {
          throw new Error("Failed to update Payment Collection");
        }

        const clearCard = await addToCardCollection.deleteMany(
          { status: true },
          { session }
        );

        if (clearCard.deletedCount <= 0) {
          throw new Error("Failed to clear Add To Card Collection");
        }

        await session.commitTransaction();
        await session.endSession();

        return res.redirect(`http://localhost:3000/payment/success/${tranId}`);
      } catch (error) {
        if (session) {
          await session.abortTransaction();
          await session.endSession();
        }
        return res.status(500).send("Internal Server Error");
      }
    });

    app.post("/api/v1/payment/fail/:tranId", async (req, res) => {
      const { productId } = await paymentCollection.findOne(
        {
          transactionID: Number(req.params.tranId),
        },
        { projection: { productId: 1 } }
      );
      var purchaseProductId = productId?.map((id) => new ObjectId(`${id}`));

      // start transaction rollback
      const session = client.startSession();
      try {
        session.startTransaction();
        const removePaymentStatus = await addToCardCollection.updateMany(
          { _id: { $in: purchaseProductId } },
          { $set: { status: false } },
          { upsert: true },
          { session }
        );
        if (removePaymentStatus.modifiedCount < 1) {
          throw new Error("Failed to update addToCardCollection");
        }

        const removePaymentDetails = await paymentCollection.deleteOne(
          { transactionID: Number(req.params.tranId) },
          { session }
        );
        if (removePaymentDetails.deletedCount !== 1) {
          throw new Error("Failed to delete paymentDetails");
        }

        await session.commitTransaction();
        await session.endSession();

        return res.redirect(
          `http://localhost:3000/payment/fail/${req.params.tranId}`
        );
      } catch (error) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(httpStatus.NOT_FOUND).send(error);
      }
    });

    app.get(
      "/api/v1/my_all_order_summary",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        const { email } = req.user;
        const projection = { isAdmin: 1, _id: 0 };
        const isAdmin = await userCollection.findOne({ email }, { projection });

        // condition
        let query;
        if (isAdmin?.isAdmin) {
          query = {};
        } else {
          query = { email };
        }

        get_all_data(paymentCollection, query, (page = 1), (limit = 100000))
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfully Get My All Order Summary",
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

    // end of transaction era

    // start review system

    app.post(
      "/api/v1/review_product",
      auth(USER_ROLE.Buyer),
      async (req, res) => {
        req.body.subcategorieId = new ObjectId(`${req.body.subcategorieId}`);
        const reviewData = {
          ...req.body,
          email: req.user.email,
        };
        post_data(reviewCollection, reviewData)
          .then((result) => {
            return res.status(httpStatus.CREATED).send({
              success: true,
              message: "Review Recorded Successfully",
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
      }
    );

    app.get(
      "/api/v1/review_product/:subcategorieId",
      auth(USER_ROLE.Buyer),
      async (req, res) => {
        const query = {
          subcategorieId: new ObjectId(`${req.params.subcategorieId}`),
        };
        get_all_data(reviewCollection, query, (page = 1), (limit = 300))
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Review Recorded Successfully",
              status: httpStatus.Ok,
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

    // update Review

    app.patch(
      "/api/v1/edit_review",
      auth(USER_ROLE.Buyer),
      async (req, res) => {
        const filter = {
          _id: new ObjectId(`${req.body.id}`),
        };
        const updateDoc = {
          $set: {
            review: req.body.review,
          },
        };
        update_data(filter, updateDoc, reviewCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Update Successfully",
              status: httpStatus.Ok,
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

    app.delete(
      "/api/v1/review_delete/:id",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        delete_data(req.params.id, reviewCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Delete Successfull",
              status: httpStatus.Ok,
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
    // completed review

    // starting wishList
    app.post(
      "/api/v1/my_wish_list",
      auth(USER_ROLE.Buyer),
      async (req, res) => {
        // Reflect.deleteProperty(req.body, process.env.TERM);
        const isExistProduct = await wishlistCollection
          .findOne({ productId: req.body.productId })
          .then((data) => data?._id);
        if (isExistProduct) {
          return res.status(httpStatus.FOUND).send({
            success: true,
            message: "Alredy Exist",
            status: httpStatus.FOUND,
          });
        }
        post_data(wishlistCollection, { email: req.user.email, ...req.body })
          .then((result) => {
            return res.status(httpStatus.CREATED).send({
              success: true,
              message: "Wish List is Created",
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
      }
    );

    app.get(
      "/api/v1/find_my_wish_list",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        const user = req.user;
        let query;
        if (user.role === process.env.buyer_account) {
          query = {
            email: user?.email,
          };
        } else {
          query = {};
        }

        const result = await wishlistCollection.find(query).toArray();

        res.status(httpStatus.OK).send({
          success: true,
          message: "Successfuly Get",
          status: httpStatus.OK,
          data: result,
        });
      }
    );

    app.delete(
      "/api/v1/delete_wish_list/:id",
      auth(USER_ROLE.Buyer),
      async (req, res) => {
        delete_data(req.params.id, wishlistCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfuly Delete",
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
    //start add to card with wishList
    app.post(
      "/api/v1/addToCard_from_wishList",
      auth(USER_ROLE.Buyer),
      async (req, res) => {
        const { brandName, name, photo, price, productId, _id } = req.body;
        const { email } = req.user;
        const isExist = await addToCardCollection
          .findOne({ productId })
          .then((data) => data?._id);
        if (isExist) {
          return res.status(httpStatus.FOUND).send({
            success: true,
            message: "Already Exist",
            status: httpStatus.FOUND,
          });
        }
        const subcategorieId = new ObjectId(`${productId}`);
        const addToCard = {
          subcategorieId,
          email,
          status: false,
          count: 0,
          brandName,
          name,
          photo,
          price,
        };
        // start transaction roll back
        const session = client.startSession();
        try {
          session.startTransaction();

          const postAddToCard = await addToCardCollection.insertOne(addToCard, {
            session,
          });
          if (!postAddToCard.insertedId) {
            throw new Error("Failed to Post addToCardCollection");
          }
          const deleteWishList = await wishlistCollection.deleteOne(
            { _id: new ObjectId(`${_id}`) },
            { session }
          );
          if (deleteWishList.deletedCount !== 1) {
            throw new Error("Failed to delete  delete Wish List");
          }

          await session.commitTransaction();
          await session.endSession();

          return res.status(httpStatus.OK).send({
            success: true,
            message: "Successfully Deleted",
            status: httpStatus.OK,
            data: postAddToCard,
          });
        } catch (error) {
          await session.abortTransaction();
          await session.endSession();
        }
      }
    );

    // get specific user information
    app.get(
      "/api/v1/specific_user_info",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        const query = {
          email: req.user.email,
        };
        specific_data(userCollection, query)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfuly Get Specific User",
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

    app.patch(
      "/api/v1/profile_picture",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        const filter = {
          email: req.user.email,
        };
        const updateDoc = {
          $set: {
            photo: req.body.image,
          },
        };
        update_data(filter, updateDoc, userCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Image Updated",
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

    // update Product Images
    app.patch(
      "/api/v1/update_productList_images/:id",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const filter = {
          email: req.user.email,
          "productList.id": req.params.id,
        };
        const updateDoc = {
          $set: {
            "productList.$.photo": req.body.photo,
          },
        };

        update_data(filter, updateDoc, productCategorie)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfully Updated",
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

    // delete product as a bulk
    app.delete(
      "/api/v1/delete_categorie_list/:id",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const { id } = req.params;
        const query = {
          productId: new ObjectId(`${id}`),
        };
        // start transaction roll back

        const session = client.startSession();
        try {
          session.startTransaction();

          //strat subcategories details
          const subCategorieDetails =
            await categoriesDetailsCollection.deleteMany(query, { session });
          if (subCategorieDetails.deletedCount !== 1) {
            throw new Error("Failed to delete  Sub Categories Details");
          }
          // start subcategories
          const subcategories = await subCategorieCollection.deleteMany(query, {
            session,
          });
          if (subcategories.deletedCount !== 1) {
            throw new Error("Failed to delete  Sub Categorie Details");
          }

          const deletecategorie = await productCategorie.updateOne(
            { "productList.id": id },
            {
              $pull: {
                productList: { id: id },
              },
            },
            { upsert: true, session }
          );
          if (deletecategorie.modifiedCount < 1) {
            throw new Error("Failed to product categories session");
          }

          await session.commitTransaction();
          await session.endSession();

          return res.status(httpStatus.OK).send({
            success: true,
            message: "Successfully Deleted",
            status: httpStatus.OK,
            data: deletecategorie,
          });
        } catch (error) {
          await session.abortTransaction();
          await session.endSession();
        }
      }
    );

    // admin dashboard working execute

    app.get(
      "/api/v1/admin/all_user",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const result = await userCollection.find({}).toArray();

        res.status(httpStatus.OK).send({
          success: true,
          message: "Successfully Get All User",
          status: httpStatus.OK,
          data: result,
        });
      }
    );

    app.patch(
      "/api/v1/admin/admin_toggle/",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const filter = {
          _id: new ObjectId(`${req.query.id}`),
        };
        const isAdminExist = await userCollection
          .findOne(filter)
          .then((data) => data._id);
        if (!isAdminExist) {
          return res.status(httpStatus.NOT_FOUND).send({
            success: true,
            message: "Unauthorized User",
            status: httpStatus.NOT_FOUND,
          });
        }
        const updateDoc = {
          $set: {
            isAdmin: req.body.isAdmin,
            date: new Date().toString(),
            creator: req.user.email,
          },
        };
        update_data(filter, updateDoc, userCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "User Role Successfully Updated",
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
      "/api/v1/admin/all_reviwes",
      auth(USER_ROLE.Seller),

      async (req, res) => {
        const query = [
          {
            $lookup: {
              from: "review", // Name of the subCategorieCollection
              localField: "_id", // Field in reviewCollection that references subCategorieCollection
              foreignField: "subcategorieId", // Field in subCategorieCollection that matches localField
              as: "productInfo", // Name to store the joined data
            },
          },
        ];

        const result = await subCategorieCollection.aggregate(query).toArray();
        res.status(httpStatus.OK).send({
          success: true,
          message: "Successfully Get All Reviwes",
          status: httpStatus.OK,
          data: result,
        });
      }
    );

    app.get(
      "/api/v1/admin/payment_schedule_information",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        // Calculate date range based on interval

        switch (req.query.interval) {
          case "daily":
            query = {
              $gte: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
            };
            break;
          case "weekly":
            query = {
              $gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
            };

            break;
          case "monthly":
            const date = new Date();
            const firstDayOfMonth = new Date(
              date.getFullYear(),
              date.getMonth(),
              1
            );
            const lastDayOfMonth = new Date(
              date.getFullYear(),
              date.getMonth() + 1,
              0
            );
            query = {
              $gte: firstDayOfMonth, // Sales on or after the first day of the current month
              $lte: lastDayOfMonth,
            };
            break;
          case "yearly":
            query = {
              $gte: new Date(
                new Date().setFullYear(new Date().getFullYear() - 1)
              ),
            };
            break;
          default:
            throw new Error("Invalid interval");
        }

        // Query MongoDB for payments within the specified date range
        const result = await paymentCollection
          .aggregate([
            {
              $match: {
                date: query,
                paidStatus: true,
              },
            },
          ])
          .toArray();
        res.status(httpStatus.OK).send({
          success: true,
          message: "Successfully Get Data",
          status: httpStatus.OK,
          data: result,
        });
      }
    );

    app.get("/api/v1/isAdmin", auth(USER_ROLE.Seller), async (req, res) => {
      const projection = { isAdmin: 1, _id: 0 };
      const isAdmin = await userCollection.findOne(
        { email: req.user.email },
        { projection }
      );
      res.status(httpStatus.OK).send(isAdmin);
    });

    // start report collection

    app.post(
      "/api/v1/report",
      auth(USER_ROLE.Buyer, USER_ROLE.Seller),
      async (req, res) => {
        // checked validation
        let report;
        const { email, role } = req.user;

        if (
          role === process.env.buyer_account &&
          req.body.transactionID &&
          req.body.productId
        ) {
          const query = { _id: new ObjectId(`${req.body.productId}`) };

          const isExistProduct = await subCategorieCollection
            .findOne(query)
            .then((data) => data?._id);

          if (!isExistProduct) {
            return res.status(httpStatus.NOT_FOUND).send({
              success: true,
              message: "This Product Id is Not Exist",
              status: httpStatus.NOT_FOUND,
            });
          }

          const isExistTransactionId = await paymentCollection
            .findOne({ transactionID: Number(req.body.transactionID) })
            .then((data) => data?._id);
          if (!isExistTransactionId) {
            return res.status(httpStatus.NOT_FOUND).send({
              success: true,
              message: "This Transaction  Id is Not Exist",
              status: httpStatus.NOT_FOUND,
            });
          }
          report = req.body;
        } else if (role === process.env.seler_account && req.body.buyerEmail) {
          const isExistUser = await userCollection
            .findOne({ email })
            .then((data) => data._id);
          if (!isExistUser) {
            return res.status(httpStatus.NOT_FOUND).send({
              success: true,
              message: "This User Not Exist in the Database",
              status: httpStatus.NOT_FOUND,
            });
          }
          report = req.body;
        } else {
          if (
            req.body.problem &&
            (role === process.env.seler_account ||
              role === process.env.buyer_account)
          ) {
            report = req.body;
          }
        }

        post_data(reportCollection, report)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfully Recorded",
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

    app.get("/api/v1/user_report", auth(USER_ROLE.Seller), async (req, res) => {
      const result = await reportCollection.find({}).toArray();
      res.status(httpStatus.OK).send({
        success: true,
        message: "Successfully Get All Report",
        status: httpStatus.OK,
        data: result,
      });
    });
    app.delete(
      "/api/v1/delete_report/:id",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        delete_data(req.params.id, reportCollection)
          .then((result) => {
            return res.status(httpStatus.OK).send({
              success: true,
              message: "Successfully Deleted",
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

    app.get("/api/v1/deshboard", auth(USER_ROLE.Seller), async (req, res) => {
      const totalUserCount = await userCollection.estimatedDocumentCount();
      const totalProductCount = await productCategorie.estimatedDocumentCount();
      const totalSubCategorieCount =
        await subCategorieCollection.estimatedDocumentCount();
      const totalProductDetailsCount =
        await categoriesDetailsCollection.estimatedDocumentCount();
      const totalChatCount = await chatbotCollection.estimatedDocumentCount();
      const totalAddToCardCount =
        await addToCardCollection.estimatedDocumentCount();
      const totalPaymentCount =
        await paymentCollection.estimatedDocumentCount();
      const totalReviewCount = await reviewCollection.estimatedDocumentCount();
      const totalWishListCount =
        await wishlistCollection.estimatedDocumentCount();
      const totalReportCount = await reportCollection.estimatedDocumentCount();
      res.status(httpStatus.OK).send({
        success: true,
        message: "Successfully Get ALL Collection Data",
        status: httpStatus.OK,
        data: {
          totalUserCount,
          totalProductCount,
          totalSubCategorieCount,
          totalProductDetailsCount,
          totalChatCount,
          totalAddToCardCount,
          totalPaymentCount,
          totalReviewCount,
          totalWishListCount,
          totalReportCount,
        },
      });
    });

    // now time to added AI
    app.post(
      "/api/v1/AI_image_generate",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const data = req.body;

        const replicate = new Replicate({
          auth: process.env.REPLICATE_API_TOKEN,
        });
        const output = await replicate.run(
          "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
          {
            input: {
              prompt: data?.image,
            },
          }
        );
        res.status(httpStatus.OK).send({
          success: true,
          status: httpStatus.OK,
          message: "Successfully  Generate The Image",
          result: output[0],
        });
      }
    );

    // delete Account
    app.delete(
      "/api/v1/deleteAccount",
      auth(USER_ROLE.Seller, USER_ROLE.Buyer),
      async (req, res) => {
        const filter = { email: req.user.email };
        const result = await userCollection.deleteOne(filter);
        res.status(httpStatus.OK).send({
          success: true,
          message: "Successfully Deleted",
          status: httpStatus.OK,
          data: result,
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
