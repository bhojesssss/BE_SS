import { Router } from 'express'
import { supabaseAnon, supabaseAdmin, getUserClient } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /users/me
router.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single()

  if (error) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Profile not found' }
    })
  }

  res.json({ success: true, data })
})

// GET /users/me/stats
router.get('/me/stats', requireAuth, async (req, res) => {
  const userId = req.user.id

  // Count purchased orders (status = Selesai)
  const { count: purchased } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('buyer_id', userId)
    .eq('status', 'Selesai')

  // Count sold orders
  const { count: sold } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .eq('status', 'Selesai')

  // Count wishlist
  const { count: wishlist } = await supabaseAdmin
    .from('wishlist')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  res.json({
    success: true,
    data: {
      purchased: purchased || 0,
      sold: sold || 0,
      wishlist: wishlist || 0
    }
  })
})

// GET /users/:id (public — info seller)
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAnon
    .from('profiles')
    .select('id, name, avatar_url, city, rating, total_sold, bio')
    .eq('id', req.params.id)
    .single()

  if (error) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found' }
    })
  }

  res.json({ success: true, data })
})

// PATCH /users/me
router.patch('/me', requireAuth, async (req, res) => {
  const { name, phone, bio, avatar_url, city } = req.body
  const supabase = getUserClient(req.token)

  const updates = {}
  if (name !== undefined) updates.name = name
  if (phone !== undefined) updates.phone = phone
  if (bio !== undefined) updates.bio = bio
  if (avatar_url !== undefined) updates.avatar_url = avatar_url
  if (city !== undefined) updates.city = city
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', req.user.id)
    .select()
    .single()

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data })
})

export default router