import { supabaseAnon } from "../config/supabase.js";

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing token" },
    });
  }

  const token = authHeader.split(" ")[1];
  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid token" },
    });
  }

  req.user = data.user;
  req.token = token;
  next();
};