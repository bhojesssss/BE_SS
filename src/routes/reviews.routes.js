import { Router } from 'express'
import { supabaseAnon, getUserClient, supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router({ mergeParams: true })

// GET /products/:id/reviews
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAnon
    .from('reviews')
    .select('*, profiles!buyer_id(name, avatar_url)')
    .eq('product_id', req.params.id)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    })
  }

  // Calculate average rating
  const avgRating = data.length
    ? data.reduce((sum, r) => sum + r.rating, 0) / data.length
    : 0

  res.json({
    success: true,
    data: {
      reviews: data,
      total: data.length,
      average_rating: Math.round(avgRating * 10) / 10
    }
  })
})

// POST /products/:id/reviews
router.post('/', requireAuth, async (req, res) => {
  const { order_id, rating, comment } = req.body

  if (!order_id || !rating) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'order_id and rating required' }
    })
  }

  if (rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Rating must be 1-5' }
    })
  }

  // Validate: order belongs to user, status = Selesai, product matches
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, buyer_id, seller_id, product_id, status')
    .eq('id', order_id)
    .single()

  if (!order || order.buyer_id !== req.user.id) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Not your order' }
    })
  }

  if (order.status !== 'Selesai') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Can only review completed orders' }
    })
  }

  if (order.product_id !== req.params.id) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Product mismatch' }
    })
  }

  const supabase = getUserClient(req.token)

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      order_id,
      product_id: req.params.id,
      buyer_id: req.user.id,
      seller_id: order.seller_id,
      rating,
      comment
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Already reviewed this order' }
      })
    }
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  // Update seller's average rating
  const { data: allReviews } = await supabaseAdmin
    .from('reviews')
    .select('rating')
    .eq('seller_id', order.seller_id)

  if (allReviews?.length) {
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
    await supabaseAdmin
      .from('profiles')
      .update({ rating: Math.round(avgRating * 10) / 10 })
      .eq('id', order.seller_id)
  }

  res.json({ success: true, data })
})

export default router