import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { createTimeSlotSchema, updateTimeSlotSchema, timeSlotParamsSchema, } from "../../schemas/index.js";
import { logger } from "../../utils/logger.js";
const router = Router();
router.get("/time-slots", requireAuth, async (req, res) => {
    const supabase = req.supabase;
    if (!supabase) {
        return res
            .status(500)
            .json({ error: "Database connection not available" });
    }
    const { data: timeSlots, error } = await supabase
        .from("user_time_slots")
        .select("*")
        .eq("user_id", req.user.id)
        .order("day_of_week", { ascending: true, nullsFirst: true })
        .order("start_time", { ascending: true });
    if (error) {
        logger.error("Get time slots error:", error);
        return res.status(500).json({ error: "获取时间段设置失败" });
    }
    const weekViewData = {
        0: [],
        1: [],
        2: [],
        3: [],
        4: [],
        5: [],
        6: [],
    };
    const globalSlots = [];
    for (const slot of timeSlots ?? []) {
        if (slot.day_of_week === null) {
            globalSlots.push(slot);
        }
        else {
            weekViewData[slot.day_of_week].push(slot);
        }
    }
    res.json({
        success: true,
        data: {
            slots: timeSlots,
            weekView: weekViewData,
            globalSlots,
        },
    });
});
router.post("/time-slots", requireAuth, validate({ body: createTimeSlotSchema }), async (req, res) => {
    const supabase = req.supabase;
    if (!supabase) {
        return res
            .status(500)
            .json({ error: "Database connection not available" });
    }
    const { day_of_week, start_time, end_time, is_available, label } = req.body;
    const startTimeParts = start_time.split(":").map(Number);
    const endTimeParts = end_time.split(":").map(Number);
    const startMinutes = startTimeParts[0] * 60 + startTimeParts[1];
    const endMinutes = endTimeParts[0] * 60 + endTimeParts[1];
    if (endMinutes <= startMinutes) {
        return res.status(400).json({ error: "结束时间必须晚于开始时间" });
    }
    let existingSlots = await supabase
        .from("user_time_slots")
        .select("*")
        .eq("user_id", req.user.id);
    if (day_of_week !== null && day_of_week !== undefined) {
        existingSlots = await supabase
            .from("user_time_slots")
            .select("*")
            .eq("user_id", req.user.id)
            .eq("day_of_week", day_of_week);
    }
    if (existingSlots.data && existingSlots.data.length > 0) {
        for (const slot of existingSlots.data) {
            const existingStart = slot.start_time.split(":").map(Number);
            const existingEnd = slot.end_time.split(":").map(Number);
            const existingStartMinutes = existingStart[0] * 60 + existingStart[1];
            const existingEndMinutes = existingEnd[0] * 60 + existingEnd[1];
            const hasOverlap = startMinutes < existingEndMinutes &&
                endMinutes > existingStartMinutes;
            if (hasOverlap) {
                return res.status(400).json({
                    error: "时间段与现有时间段冲突",
                    conflictingSlot: slot,
                });
            }
        }
    }
    const { data: timeSlot, error } = await supabase
        .from("user_time_slots")
        .insert({
        user_id: req.user.id,
        day_of_week: day_of_week ?? null,
        start_time,
        end_time,
        is_available: is_available ?? true,
        label,
    })
        .select()
        .single();
    if (error) {
        logger.error("Create time slot error:", error);
        return res.status(500).json({ error: "创建时间段失败" });
    }
    res.status(201).json({ success: true, data: timeSlot });
});
router.put("/time-slots/:id", requireAuth, validate({ params: timeSlotParamsSchema, body: updateTimeSlotSchema }), async (req, res) => {
    const supabase = req.supabase;
    if (!supabase) {
        return res
            .status(500)
            .json({ error: "Database connection not available" });
    }
    const { id } = req.params;
    const { start_time, end_time, is_available, label } = req.body;
    const { data: existingSlot, error: fetchError } = await supabase
        .from("user_time_slots")
        .select("*")
        .eq("id", id)
        .eq("user_id", req.user.id)
        .single();
    if (fetchError || !existingSlot) {
        return res.status(404).json({ error: "时间段不存在" });
    }
    const finalStartTime = start_time ?? existingSlot.start_time;
    const finalEndTime = end_time ?? existingSlot.end_time;
    const startTimeParts = finalStartTime.split(":").map(Number);
    const endTimeParts = finalEndTime.split(":").map(Number);
    const startMinutes = startTimeParts[0] * 60 + startTimeParts[1];
    const endMinutes = endTimeParts[0] * 60 + endTimeParts[1];
    if (endMinutes <= startMinutes) {
        return res.status(400).json({ error: "结束时间必须晚于开始时间" });
    }
    if (start_time || end_time) {
        const { data: otherSlots } = await supabase
            .from("user_time_slots")
            .select("*")
            .eq("user_id", req.user.id)
            .neq("id", id);
        const slotsToCheck = existingSlot.day_of_week !== null
            ? otherSlots?.filter((s) => s.day_of_week === existingSlot.day_of_week)
            : otherSlots?.filter((s) => s.day_of_week === null);
        for (const slot of slotsToCheck ?? []) {
            const existingStart = slot.start_time.split(":").map(Number);
            const existingEnd = slot.end_time.split(":").map(Number);
            const existingStartMinutes = existingStart[0] * 60 + existingStart[1];
            const existingEndMinutes = existingEnd[0] * 60 + existingEnd[1];
            const hasOverlap = startMinutes < existingEndMinutes &&
                endMinutes > existingStartMinutes;
            if (hasOverlap) {
                return res.status(400).json({
                    error: "时间段与现有时间段冲突",
                    conflictingSlot: slot,
                });
            }
        }
    }
    const updateData = {};
    if (start_time !== undefined)
        updateData.start_time = start_time;
    if (end_time !== undefined)
        updateData.end_time = end_time;
    if (is_available !== undefined)
        updateData.is_available = is_available;
    if (label !== undefined)
        updateData.label = label;
    const { data: timeSlot, error } = await supabase
        .from("user_time_slots")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", req.user.id)
        .select()
        .single();
    if (error) {
        logger.error("Update time slot error:", error);
        return res.status(500).json({ error: "更新时间段失败" });
    }
    res.json({ success: true, data: timeSlot });
});
router.delete("/time-slots/:id", requireAuth, validate({ params: timeSlotParamsSchema }), async (req, res) => {
    const supabase = req.supabase;
    if (!supabase) {
        return res
            .status(500)
            .json({ error: "Database connection not available" });
    }
    const { id } = req.params;
    const { error } = await supabase
        .from("user_time_slots")
        .delete()
        .eq("id", id)
        .eq("user_id", req.user.id);
    if (error) {
        logger.error("Delete time slot error:", error);
        return res.status(500).json({ error: "删除时间段失败" });
    }
    res.json({ success: true });
});
export default router;
//# sourceMappingURL=timeSlots.js.map