import { Router } from 'express'
import { supabaseAnon, getUserClient } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import reviewsRoutes from './reviews.routes.js'

const router = Router()
router.use('/:id/reviews', reviewsRoutes)

// GET /products?type=fashion&category=t-shirts&q=keyword&sort=newest&page=1&limit=20
router.get('/', async (req, res) => {
  const { type, category, q, sort = 'newest', page = 1, limit = 20 } = req.query

  let query = supabaseAnon
    .from('products')
    .select('*, categories!inner(name, slug, type), profiles!seller_id(name, rating, city)')
    .eq('is_available', true)

  if (type) query = query.eq('categories.type', type)
  if (category) query = query.eq('categories.slug', category)
  if (q) query = query.ilike('name', `%${q}%`)

  if (sort === 'price-asc') query = query.order('price', { ascending: true })
  else if (sort === 'price-desc') query = query.order('price', { ascending: false })
  else if (sort === 'popular') query = query.order('sold_count', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const { data, error } = await query
  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data })
})

// GET /products/recommended
router.get('/recommended', async (req, res) => {
  const { data, error } = await supabaseAnon
    .from('products')
    .select('*, categories(name, slug, type)')
    .eq('is_available', true)
    .order('sold_count', { ascending: false })
    .limit(8)

  if (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data })
})

// GET /products/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAnon
    .from('products')
    .select('*, categories(name, slug, type), profiles!seller_id(id, name, rating, city, total_sold)')
    .eq('id', req.params.id)
    .single()

  if (error) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Product not found' }
    })
  }

  res.json({ success: true, data })
})

// POST /products
router.post('/', requireAuth, async (req, res) => {
  const { name, description, price, category_id, condition, size, images } = req.body

  if (!name || !price || !category_id || !condition || !size) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' }
    })
  }

  const supabase = getUserClient(req.token)
  const { data, error } = await supabase
    .from('products')
    .insert({
      seller_id: req.user.id,
      name,
      description,
      price,
      category_id,
      condition,
      size,
      images: images || []
    })
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

// PATCH /products/:id
router.patch('/:id', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const { data, error } = await supabase
    .from('products')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
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

// DELETE /products/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.token)
  const { error } = await supabase.from('products').delete().eq('id', req.params.id)

  if (error) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: error.message }
    })
  }

  res.json({ success: true, data: { message: 'Deleted' } })
})

export default router