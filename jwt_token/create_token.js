const jwt = require("jsonwebtoken");
const { catchAsync } = require("./catchAsync");
const httpStatus = require("http-status");

const create_token = (data) => {
  const token = jwt.sign(data, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.EXPIRES_IN,
  });
  return token;
};

const auth = (...requireRoles) => {
  console.log(requireRoles);
  return catchAsync(async (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
      throw new Error({
        success: false,
        status: httpStatus.UNAUTHORIZED,
        errorMessage: "Unauthorized Token",
      });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      throw new Error({
        success: false,
        status: httpStatus.UNAUTHORIZED,
        errorMessage: "Unauthorized USER",
      });
    }

    // after fontend Authenticatione this part started

    next();
  });
};

module.exports = {
  create_token,
  auth,
};
