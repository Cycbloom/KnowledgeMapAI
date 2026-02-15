import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Swords, 
  Users, 
  Trophy, 
  Clock, 
  CheckCircle, 
  XCircle,
  Loader2,
  RefreshCw,
  Play,
  User
} from 'lucide-react';
import { api } from '../../services/api';
import { useMessageStore } from '../../store/useMessageStore';
import { useErrorHandler } from '../../hooks/useErrorHandler';

interface Battle {
  id: string;
  status: string;
  total_rounds: number;
  time_limit: number;
  created_at: string;
  graphs?: { title: string };
  profiles?: { username: string; avatar_url: string };
}

interface BattleDetail {
  id: string;
  status: string;
  current_round: number;
  total_rounds: number;
  challenger_score: number;
  opponent_score: number;
  time_limit: number;
  is_challenger: boolean;
  challenger: { id: string; username: string; avatar_url?: string };
  opponent?: { id: string; username: string; avatar_url?: string };
  graph_title: string;
}

interface Round {
  id: string;
  round_number: number;
  question: string;
  answer?: string;
  correct?: boolean;
  time_limit: number;
}

interface CurrentRound {
  id: string;
  round_number: number;
  question: string;
  answer: string;
  time_limit: number;
}

interface BattleArenaProps {
  battleId: string;
  onBattleEnd?: () => void;
}

export const BattleArena: React.FC<BattleArenaProps> = ({ battleId, onBattleEnd }) => {
  const [battle, setBattle] = useState<BattleDetail | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRound, setCurrentRound] = useState<CurrentRound | null>(null);
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<{ correct: boolean; answer: string } | null>(null);
  
  const { addMessage } = useMessageStore();
  const { handleError } = useErrorHandler();

  const fetchBattle = useCallback(async () => {
    try {
      const result = await api.battles.get(battleId);
      setBattle(result.battle);
      setRounds(result.rounds || []);
      setCurrentRound(result.current_round_data);
      setTimeLeft(result.battle?.time_limit || 30);
    } catch (error) {
      handleError(error, { context: 'BattleArena' });
    }
  }, [battleId, handleError]);

  useEffect(() => {
    fetchBattle();
    const interval = setInterval(fetchBattle, 3000);
    return () => clearInterval(interval);
  }, [fetchBattle]);

  useEffect(() => {
    if (battle?.status === 'active' && currentRound && timeLeft > 0 && !showResult) {
      const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !showResult && currentRound) {
      handleSubmit(true);
    }
  }, [timeLeft, battle?.status, currentRound, showResult]);

  const handleSubmit = async (timeout = false) => {
    if (!currentRound || isSubmitting) return;
    
    setIsSubmitting(true);
    setShowResult(true);

    try {
      const result = await api.battles.submitAnswer({
        battle_id: battleId,
        round_number: currentRound.round_number,
        answer: timeout ? '' : answer,
        time_taken: battle?.time_limit - timeLeft
      });

      setLastResult({
        correct: result.correct,
        answer: result.correct_answer
      });

      setTimeout(() => {
        setShowResult(false);
        setAnswer('');
        setLastResult(null);
        fetchBattle();
      }, 2000);

    } catch (error) {
      handleError(error, { context: 'SubmitAnswer' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!battle) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (battle.status === 'pending') {
    return (
      <div className="text-center py-12">
        <Users className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-pulse" />
        <h3 className="text-xl font-bold mb-2">等待对手加入...</h3>
        <p className="text-gray-500">分享对战链接邀请好友</p>
        <div className="mt-4 p-3 bg-gray-100 dark:bg-slate-700 rounded-lg">
          <code className="text-sm">{window.location.origin}/battle/{battleId}</code>
        </div>
      </div>
    );
  }

  if (battle.status === 'completed') {
    const myScore = battle.is_challenger ? battle.challenger_score : battle.opponent_score;
    const opponentScore = battle.is_challenger ? battle.opponent_score : battle.challenger_score;
    const isWin = myScore > opponentScore;
    const isDraw = myScore === opponentScore;

    return (
      <div className="text-center py-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
            isWin ? 'bg-yellow-500' : isDraw ? 'bg-gray-500' : 'bg-red-500'
          }`}
        >
          <Trophy className="w-10 h-10 text-white" />
        </motion.div>
        <h3 className="text-2xl font-bold mb-2">
          {isWin ? '胜利！' : isDraw ? '平局' : '失败'}
        </h3>
        <p className="text-gray-500 mb-4">
          最终比分：{myScore} - {opponentScore}
        </p>
        <button
          onClick={onBattleEnd}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="battle-arena">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
              {battle.challenger.username[0].toUpperCase()}
            </div>
            <p className="text-sm mt-1">{battle.challenger.username}</p>
            <p className="text-lg font-bold text-blue-500">{battle.challenger_score}</p>
          </div>
          <Swords className="w-6 h-6 text-gray-400" />
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
              {battle.opponent?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <p className="text-sm mt-1">{battle.opponent?.username || '等待中'}</p>
            <p className="text-lg font-bold text-red-500">{battle.opponent_score}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">第 {battle.current_round} / {battle.total_rounds} 轮</div>
          <div className="text-sm text-gray-500">{battle.graph_title}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">剩余时间</span>
          <span className={`text-lg font-bold ${timeLeft <= 10 ? 'text-red-500' : 'text-gray-700'}`}>
            {timeLeft}s
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${timeLeft <= 10 ? 'bg-red-500' : 'bg-blue-500'}`}
            initial={{ width: '100%' }}
            animate={{ width: `${(timeLeft / (battle.time_limit || 30)) * 100}%` }}
          />
        </div>
      </div>

      {currentRound && (
        <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-6 mb-4">
          <h4 className="text-lg font-medium mb-4">{currentRound.question}</h4>
          
          <AnimatePresence mode="wait">
            {showResult && lastResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`text-center py-4 ${
                  lastResult.correct ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {lastResult.correct ? (
                  <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                ) : (
                  <XCircle className="w-12 h-12 mx-auto mb-2" />
                )}
                <p className="text-lg font-bold">
                  {lastResult.correct ? '回答正确！' : '回答错误'}
                </p>
                {!lastResult.correct && (
                  <p className="text-sm text-gray-500 mt-2">
                    正确答案：{lastResult.answer}
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="输入你的答案..."
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                  autoFocus
                />
                <button
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting || !answer.trim()}
                  className="w-full mt-3 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    '提交答案'
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto py-2">
        {rounds.map((round) => (
          <div
            key={round.id}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              round.correct === true
                ? 'bg-green-500 text-white'
                : round.correct === false
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 text-gray-600'
            }`}
          >
            {round.round_number}
          </div>
        ))}
      </div>
    </div>
  );
};

interface BattleLobbyProps {
  graphId: string;
  onBattleStart?: (battleId: string) => void;
}

export const BattleLobby: React.FC<BattleLobbyProps> = ({ graphId, onBattleStart }) => {
  const [pendingBattles, setPendingBattles] = useState<Battle[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { addMessage } = useMessageStore();
  const { handleError } = useErrorHandler();

  const fetchPendingBattles = useCallback(async () => {
    try {
      const result = await api.battles.getPending();
      setPendingBattles(result.battles || []);
    } catch (error) {
      handleError(error, { context: 'FetchPendingBattles' });
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    fetchPendingBattles();
  }, [fetchPendingBattles]);

  const handleCreateBattle = async (opponentId?: string) => {
    setIsCreating(true);
    try {
      const result = await api.battles.create({
        graph_id: graphId,
        opponent_id: opponentId,
        total_rounds: 5,
        time_limit: 30
      });
      
      addMessage({ type: 'success', content: '对战创建成功！' });
      onBattleStart?.(result.battle.id);
    } catch (error) {
      handleError(error, { context: 'CreateBattle', fallbackMessage: '创建对战失败' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinBattle = async (battleId: string) => {
    try {
      await api.battles.join(battleId);
      addMessage({ type: 'success', content: '成功加入对战！' });
      onBattleStart?.(battleId);
    } catch (error) {
      handleError(error, { context: 'JoinBattle', fallbackMessage: '加入对战失败' });
    }
  };

  return (
    <div className="battle-lobby p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg">
          <Swords className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">知识对战</h2>
          <p className="text-sm text-gray-500">与其他用户进行知识答题对战</p>
        </div>
      </div>

      <button
        onClick={() => handleCreateBattle()}
        disabled={isCreating}
        className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-medium rounded-lg hover:from-red-600 hover:to-orange-600 disabled:opacity-50 flex items-center justify-center gap-2 mb-6"
      >
        {isCreating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Swords className="w-5 h-5" />
        )}
        创建新对战
      </button>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">等待加入的对战</h3>
        <button
          onClick={fetchPendingBattles}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : pendingBattles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>暂无等待中的对战</p>
          <p className="text-sm">创建一个新对战吧！</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingBattles.map((battle) => (
            <div
              key={battle.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  {battle.profiles?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-medium">{battle.profiles?.username || '未知用户'}</p>
                  <p className="text-sm text-gray-500">
                    {battle.graphs?.title} · {battle.total_rounds} 轮
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleJoinBattle(battle.id)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1"
              >
                <Play size={16} />
                加入
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BattleArena;
