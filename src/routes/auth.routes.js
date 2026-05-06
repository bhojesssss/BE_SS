import { Router } from "express";
import { supabaseAnon, supabaseAdmin } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// POST /auth/register
router.post("/register", async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Name, email, password required",
      },
    });
  }

  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone },
    },
  });

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: error.message },
    });
  }

  res.json({
    success: true,
    data: {
      user: data.user,
      session: data.session,
    },
  });
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: error.message },
    });
  }

  res.json({
    success: true,
    data: {
      user: data.user,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
});

// POST /auth/logout
router.post("/logout", requireAuth, async (req, res) => {
  await supabaseAnon.auth.admin.signOut(req.token);
  res.json({ success: true, data: { message: "Logged out" } });
});

// GET /auth/me
router.get("/me", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", req.user.id)
    .single();

  if (error) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Profile not found" },
    });
  }

  res.json({ success: true, data });
});

export default router;