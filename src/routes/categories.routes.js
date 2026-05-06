import { Router } from 'express'
import { supabaseAnon } from '../config/supabase.js'

const router = Router()

// GET /categories?type=fashion
router.get('/', async (req, res) => {
  const { type } = req.query

  let query = supabaseAnon.from('categories').select('*').order('id')
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data })
})

export default router