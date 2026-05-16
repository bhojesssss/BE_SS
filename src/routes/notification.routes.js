import { Router } from 'express'
import { getUserClient, supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const { type, unread } = req.query
    const supabase = getUserClient(req.token)

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (type) query = query.eq('type', type)
    if (unread === 'true') query = query.eq('is_read', false)

    const { data, error } = await query

    if (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: error.message }
      })
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false)

    res.json({
      success: true,
      data: {
        notifications: data,
        unread_count: unreadCount || 0
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
})

// BUG-003 FIX: PATCH /read-all MUST be declared BEFORE PATCH /:id/read
// Otherwise Express matches "read-all" as an :id param and this handler is never reached
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const supabase = getUserClient(req.token)

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false)

    if (error) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.message }
      })
    }

    res.json({ success: true, data: { message: 'All marked as read' } })
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
})

// GET /notifications/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const supabase = getUserClient(req.token)

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' }
      })
    }

    // Auto-mark as read when opened
    if (!data.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', req.params.id)
      data.is_read = true
    }

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
})

// PATCH /notifications/:id/read
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const supabase = getUserClient(req.token)

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
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
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
})

export default router