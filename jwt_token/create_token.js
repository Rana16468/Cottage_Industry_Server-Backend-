const jwt = require("jsonwebtoken");
const { catchAsync } = require("./catchAsync");
const httpStatus = require("http-status");
const { userCollection } = require("../DB/mongoDB");

const create_token = (data) => {
  const token = jwt.sign(data, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.EXPIRES_IN,
  });
  return token;
};

const auth = (...requireRoles) => {
  return catchAsync(async (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(httpStatus.UNAUTHORIZED).send({
        success: false,
        status: httpStatus.UNAUTHORIZED,
        errorMessage: "Unauthorized Token",
      });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return res.status(httpStatus.UNAUTHORIZED).send({
        success: false,
        status: httpStatus.UNAUTHORIZED,
        errorMessage: "Unauthorized USER",
      });
    }

    // after fontend Authenticatione this part started
    const { role, email } = decoded;
    const isUserExist = await userCollection
      .findOne({ email })
      .then((data) => data._id);
    if (!isUserExist) {
      return res.status(httpStatus.NOT_FOUND).send({
        success: false,
        status: httpStatus.NOT_FOUND,
        errorMessage: "User data not exist in the  Database",
      });
    }
    if (requireRoles && !requireRoles.includes(role)) {
      return res.status(httpStatus.UNAUTHORIZED).send({
        success: false,
        status: httpStatus.UNAUTHORIZED,
        errorMessage: "Yout Role Not Exist",
      });
    }
    req.user = decoded;

    next();
  });
};

module.exports = {
  create_token,
  auth,
};
