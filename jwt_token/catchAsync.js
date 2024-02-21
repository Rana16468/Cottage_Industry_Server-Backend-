const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => next(err));
  };
};

const USER_ROLE = {
  Buyer: process.env.buyer_account,
  Seller: process.env.seler_account,
};

module.exports = { catchAsync, USER_ROLE };
