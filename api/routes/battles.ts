import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { supabaseAdmin } from '../supabase.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const router = Router();

const createBattleSchema = z.object({
  graph_id: z.string().uuid(),
  opponent_id: z.string().uuid().optional(),
  total_rounds: z.number().min(3).max(10).default(5),
  time_limit: z.number().min(10).max(120).default(30),
});

const submitAnswerSchema = z.object({
  battle_id: z.string().uuid(),
  round_number: z.number(),
  answer: z.string(),
  time_taken: z.number().optional(),
});

interface BattleRound {
  id: string;
  battle_id: string;
  round_number: number;
  card_id: string;
  card_question: string;
  card_answer: string;
  challenger_answer?: string;
  opponent_answer?: string;
  challenger_correct?: boolean;
  opponent_correct?: boolean;
  time_limit: number;
}

interface Battle {
  id: string;
  challenger_id: string;
  opponent_id?: string;
  graph_id: string;
  status: 'pending' | 'matched' | 'active' | 'completed' | 'cancelled';
  current_round: number;
  total_rounds: number;
  challenger_score: number;
  opponent_score: number;
  time_limit: number;
  created_at: string;
  completed_at?: string;
}

router.post('/create', requireAuth, validate(createBattleSchema), async (req: AuthRequest, res: Response) => {
  const { graph_id, opponent_id, total_rounds, time_limit } = req.body;
  const supabase = req.supabase!;

  try {
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id, question, answer')
      .eq('graph_id', graph_id)
      .limit(total_rounds * 2);

    if (cardsError) throw new AppError(cardsError.message, 500, ErrorCodes.INTERNAL_ERROR);
    
    if (!cards || cards.length < total_rounds) {
      throw new AppError('题目数量不足，无法创建对战', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const shuffledCards = cards.sort(() => Math.random() - 0.5).slice(0, total_rounds);

    const { data: battle, error: battleError } = await supabase
      .from('battles')
      .insert({
        challenger_id: req.user.id,
        opponent_id: opponent_id || null,
        graph_id,
        status: opponent_id ? 'matched' : 'pending',
        current_round: 0,
        total_rounds,
        challenger_score: 0,
        opponent_score: 0,
        time_limit
      })
      .select()
      .single();

    if (battleError) throw new AppError(battleError.message, 500, ErrorCodes.INTERNAL_ERROR);

    const roundsToInsert = shuffledCards.map((card, index) => ({
      battle_id: battle.id,
      round_number: index + 1,
      card_id: card.id,
      card_question: card.question,
      card_answer: card.answer,
      time_limit
    }));

    const { error: roundsError } = await supabase
      .from('battle_rounds')
      .insert(roundsToInsert);

    if (roundsError) {
      await supabase.from('battles').delete().eq('id', battle.id);
      throw new AppError(roundsError.message, 500, ErrorCodes.INTERNAL_ERROR);
    }

    res.json({
      success: true,
      battle: {
        id: battle.id,
        status: battle.status,
        total_rounds: battle.total_rounds,
        time_limit: battle.time_limit,
        current_round: 0
      }
    });

  } catch (error: any) {
    logger.error('Create Battle Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '创建对战失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/pending', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const { data: pendingBattles, error } = await supabase
      .from('battles')
      .select(`
        id,
        graph_id,
        total_rounds,
        time_limit,
        created_at,
        graphs(title),
        profiles!battles_challenger_id_fkey(username, avatar_url)
      `)
      .eq('status', 'pending')
      .neq('challenger_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);

    res.json({ battles: pendingBattles });

  } catch (error: any) {
    logger.error('Get Pending Battles Error:', error);
    throw new AppError(error.message || '获取待匹配对战失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/join/:battleId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { battleId } = req.params;
  const supabase = req.supabase!;

  try {
    const { data: battle, error: battleError } = await supabase
      .from('battles')
      .select('*')
      .eq('id', battleId)
      .eq('status', 'pending')
      .single();

    if (battleError || !battle) {
      throw new AppError('对战不存在或已被其他人加入', 404, ErrorCodes.NOT_FOUND);
    }

    if (battle.challenger_id === req.user.id) {
      throw new AppError('不能加入自己创建的对战', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { error: updateError } = await supabase
      .from('battles')
      .update({ 
        opponent_id: req.user.id,
        status: 'matched',
        current_round: 1
      })
      .eq('id', battleId);

    if (updateError) throw new AppError(updateError.message, 500, ErrorCodes.INTERNAL_ERROR);

    res.json({ success: true, battle_id: battleId });

  } catch (error: any) {
    logger.error('Join Battle Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '加入对战失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/:battleId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { battleId } = req.params;
  const supabase = req.supabase!;

  try {
    const { data: battle, error: battleError } = await supabase
      .from('battles')
      .select(`
        *,
        challenger:profiles!battles_challenger_id_fkey(id, username, avatar_url),
        opponent:profiles!battles_opponent_id_fkey(id, username, avatar_url),
        graphs(title)
      `)
      .eq('id', battleId)
      .single();

    if (battleError || !battle) {
      throw new AppError('对战不存在', 404, ErrorCodes.NOT_FOUND);
    }

    const isParticipant = battle.challenger_id === req.user.id || battle.opponent_id === req.user.id;
    if (!isParticipant) {
      throw new AppError('无权查看此对战', 403, ErrorCodes.FORBIDDEN);
    }

    const { data: rounds, error: roundsError } = await supabase
      .from('battle_rounds')
      .select('id, round_number, card_question, card_answer, challenger_answer, opponent_answer, challenger_correct, opponent_correct, time_limit')
      .eq('battle_id', battleId)
      .order('round_number', { ascending: true });

    if (roundsError) throw new AppError(roundsError.message, 500, ErrorCodes.INTERNAL_ERROR);

    const isChallenger = battle.challenger_id === req.user.id;
    const currentRound = rounds?.find(r => r.round_number === battle.current_round);

    res.json({
      battle: {
        id: battle.id,
        status: battle.status,
        current_round: battle.current_round,
        total_rounds: battle.total_rounds,
        challenger_score: battle.challenger_score,
        opponent_score: battle.opponent_score,
        time_limit: battle.time_limit,
        is_challenger: isChallenger,
        challenger: battle.challenger,
        opponent: battle.opponent,
        graph_title: battle.graphs?.title
      },
      rounds: rounds?.map(r => ({
        id: r.id,
        round_number: r.round_number,
        question: r.card_question,
        answer: isChallenger ? r.challenger_answer : r.opponent_answer,
        correct: isChallenger ? r.challenger_correct : r.opponent_correct,
        time_limit: r.time_limit
      })),
      current_round_data: currentRound ? {
        id: currentRound.id,
        round_number: currentRound.round_number,
        question: currentRound.card_question,
        answer: currentRound.card_answer,
        time_limit: currentRound.time_limit
      } : null
    });

  } catch (error: any) {
    logger.error('Get Battle Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '获取对战信息失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/submit-answer', requireAuth, validate(submitAnswerSchema), async (req: AuthRequest, res: Response) => {
  const { battle_id, round_number, answer, time_taken } = req.body;
  const supabase = req.supabase!;

  try {
    const { data: battle, error: battleError } = await supabase
      .from('battles')
      .select('*')
      .eq('id', battle_id)
      .single();

    if (battleError || !battle) {
      throw new AppError('对战不存在', 404, ErrorCodes.NOT_FOUND);
    }

    const isChallenger = battle.challenger_id === req.user.id;
    const isOpponent = battle.opponent_id === req.user.id;

    if (!isChallenger && !isOpponent) {
      throw new AppError('无权参与此对战', 403, ErrorCodes.FORBIDDEN);
    }

    const { data: round, error: roundError } = await supabase
      .from('battle_rounds')
      .select('*')
      .eq('battle_id', battle_id)
      .eq('round_number', round_number)
      .single();

    if (roundError || !round) {
      throw new AppError('回合不存在', 404, ErrorCodes.NOT_FOUND);
    }

    const isCorrect = answer.trim().toLowerCase() === round.card_answer.trim().toLowerCase();

    const updateData = isChallenger 
      ? { challenger_answer: answer, challenger_correct: isCorrect }
      : { opponent_answer: answer, opponent_correct: isCorrect };

    const { error: updateRoundError } = await supabase
      .from('battle_rounds')
      .update(updateData)
      .eq('id', round.id);

    if (updateRoundError) throw new AppError(updateRoundError.message, 500, ErrorCodes.INTERNAL_ERROR);

    let scoreUpdate = {};
    if (isCorrect) {
      scoreUpdate = isChallenger 
        ? { challenger_score: battle.challenger_score + 1 }
        : { opponent_score: battle.opponent_score + 1 };
    }

    const bothAnswered = (isChallenger && round.opponent_answer) || (isOpponent && round.challenger_answer);
    
    if (bothAnswered && battle.current_round < battle.total_rounds) {
      await supabase
        .from('battles')
        .update({ 
          ...scoreUpdate,
          current_round: battle.current_round + 1 
        })
        .eq('id', battle_id);
    } else if (bothAnswered && battle.current_round === battle.total_rounds) {
      await supabase
        .from('battles')
        .update({ 
          ...scoreUpdate,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', battle_id);
    } else {
      await supabase
        .from('battles')
        .update(scoreUpdate)
        .eq('id', battle_id);
    }

    res.json({ 
      success: true, 
      correct: isCorrect,
      correct_answer: round.card_answer
    });

  } catch (error: any) {
    logger.error('Submit Answer Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || '提交答案失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/history/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const supabase = req.supabase!;

  try {
    const { data: battles, error } = await supabase
      .from('battles')
      .select(`
        id,
        status,
        total_rounds,
        challenger_score,
        opponent_score,
        created_at,
        completed_at,
        challenger_id,
        opponent_id,
        graph_id
      `)
      .or(`challenger_id.eq.${req.user.id},opponent_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new AppError(error.message, 500, ErrorCodes.INTERNAL_ERROR);

    const graphIds = new Set<string>();
    battles?.forEach(b => {
      if (b.graph_id) graphIds.add(b.graph_id);
    });

    const { data: graphs } = await supabase
      .from('graphs')
      .select('id, title')
      .in('id', Array.from(graphIds));

    const graphMap = new Map(graphs?.map(g => [g.id, g]));

    const userIds = new Set<string>();
    battles?.forEach(b => {
      if (b.challenger_id) userIds.add(b.challenger_id);
      if (b.opponent_id) userIds.add(b.opponent_id);
    });

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', Array.from(userIds));

    const profileMap = new Map(profiles?.map(p => [p.id, p]));

    const processedBattles = battles?.map(b => {
      const isChallenger = b.challenger_id === req.user.id;
      const myScore = isChallenger ? b.challenger_score : b.opponent_score;
      const opponentScore = isChallenger ? b.opponent_score : b.challenger_score;
      const challenger = profileMap.get(b.challenger_id);
      const opponent = profileMap.get(b.opponent_id);
      
      let result = 'pending';
      if (b.status === 'completed') {
        if (myScore > opponentScore) result = 'win';
        else if (myScore < opponentScore) result = 'lose';
        else result = 'draw';
      }

      return {
        id: b.id,
        status: b.status,
        result,
        my_score: myScore,
        opponent_score: opponentScore,
        graph_title: graphMap.get(b.graph_id)?.title,
        opponent: isChallenger ? opponent : challenger,
        created_at: b.created_at,
        completed_at: b.completed_at
      };
    });

    res.json({ battles: processedBattles });

  } catch (error: any) {
    logger.error('Get Battle History Error:', error);
    throw new AppError(error.message || '获取对战历史失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
