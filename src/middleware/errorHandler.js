export const errorHandler = (err, req, res, next) => {
  console.error("[ERROR]", err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || "SERVER_ERROR",
      message: err.message || "Something went wrong",
    },
  });
};