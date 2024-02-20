const { ObjectId } = require("mongodb");

const get_all_data = async (databaseCollection, query) => {
  const result = await databaseCollection.find(query).toArray();
  return result;
};

const post_data = async (databaseCollection, data) => {
  const reset = await databaseCollection.insertOne(data);
  return reset;
};

const specific_data = async (databaseCollection, data) => {
  const reset = await databaseCollection.findOne(data);
  return reset;
};

const update_data = async (filter, updateDoc, databaseCollection) => {
  const result = await databaseCollection.updateOne(filter, updateDoc, {
    upsert: true,
  });
  return result;
};

const delete_data = async (id, databaseCollection) => {
  const query = { _id: new ObjectId(id) };
  const result = await databaseCollection.deleteOne(query);
  return result;
};

module.exports = {
  get_all_data,
  post_data,
  specific_data,
  update_data,
  delete_data,
};
