const { paymentCollection } = require("../DB/mongoDB");

const CheckedPaymentSuccess = async () => {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const paymentFailed = await paymentCollection
    .find({
      date: { $lte: thirtyMinAgo },
      paidStatus: false,
    })
    .project({ _id: 1 })
    .toArray();

  const idsToDelete = paymentFailed?.map((id) => id._id);
  if (idsToDelete?.length > 0) {
    await paymentCollection.deleteMany({
      _id: { $in: idsToDelete },
    });
  }
};
module.exports = {
  CheckedPaymentSuccess,
};
