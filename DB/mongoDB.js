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

module.exports = {
  productCategorie,
  connectedDatabase,
  userCollection,
  subCategorieCollection,
};
