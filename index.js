const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const {
  post_data,
  update_data,

  aggregate_data,
  get_all_data,
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
} = require("./DB/mongoDB");
const {
  upload,
  sendImageToCloudinary,
} = require("./reuseable_method/ImageGenarator");
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
        const page = Number(req?.query?.page) || 1; // page --->
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

    // get all specific seller  categoriesal data

    app.get(
      "/api/v1/specific_user_product",
      auth(USER_ROLE.Seller),
      async (req, res) => {
        const page = Number(req?.query?.page) || 1;
        const limit = Number(req?.query?.limit) || 25;
        const query = [
          // state1
          {
            $match: { email: req.user.email },
          },
        ];

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
        console.log(id); // multiple collection delete at a time
        /* delete_data(id,productCategorie).then((result)=>{
          return res.status(httpStatus.OK).send({
            success: true,
            status: httpStatus.OK,
            message: " Categorie Delete Successfull",
           
          });
        }).catch((error)=>{
          return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
            success: false,
            message: error?.message,
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
        })*/
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

        aggregate_data(query, chatbotCollection, (page = 1), (limit = 25))
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
