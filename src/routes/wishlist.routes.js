import { Router } from 'express'
import { getUserClient } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /wishlist
router.get('/', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const { data, error } = await supabase
    .from('wishlist')
    .select('*, products(*, categories(name, slug, type), profiles!seller_id(name, rating))')
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data })
})

// POST /wishlist/:productId
router.post('/:productId', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)

  const { data, error } = await supabase
    .from('wishlist')
    .insert({
      user_id: req.user.id,
      product_id: req.params.productId
    })
    .select()
    .single()

  if (error) {
    // Kemungkinan duplicate (unique constraint)
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Already in wishlist' }
      })
    }
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data })
})

// DELETE /wishlist/:productId
router.delete('/:productId', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const { error } = await supabase
    .from('wishlist')
    .delete()
    .eq('user_id', req.user.id)
    .eq('product_id', req.params.productId)

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data: { message: 'Removed from wishlist' } })
})

export default router