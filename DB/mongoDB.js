const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const connectedDatabase = async () => {
  await client.connect();
  console.log("Connected to MongoDB");
};

const db = client.db("assignment");
const productCategorie = db.collection("categorie");
const userCollection = db.collection("user");
const subCategorieCollection = db.collection("subcategorie");
const categoriesDetailsCollection = db.collection("details");
const chatbotCollection = db.collection("chatbot");
const addToCardCollection = db.collection("addtocard");
const paymentCollection = db.collection("payment");
const reviewCollection = db.collection("review");
const wishlistCollection = db.collection("wishlist");
const reportCollection = db.collection("report");

module.exports = {
  productCategorie,
  connectedDatabase,
  client,
  userCollection,
  subCategorieCollection,
  categoriesDetailsCollection,
  chatbotCollection,
  addToCardCollection,
  paymentCollection,
  reviewCollection,
  wishlistCollection,
  reportCollection,
};
