import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStudyCards, useUpdateCardProgressMutation } from '../hooks/useQueries';
import { StudyCard } from '../types';
import { Check, X, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const Study = () => {
  const [searchParams] = useSearchParams();
  const graphId = searchParams.get('graph_id');
  
  const { data: fetchedCards, isLoading, refetch } = useStudyCards(graphId || undefined);
  const updateProgressMutation = useUpdateCardProgressMutation();

  const [cards, setCards] = useState<StudyCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [finished, setFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Reset state when graphId changes
  useEffect(() => {
    setCards([]);
    setCurrentCardIndex(0);
    setFinished(false);
    setShowAnswer(false);
    setSelectedOption(null);
  }, [graphId]);

  // Sync and shuffle cards when data is loaded
  useEffect(() => {
    if (fetchedCards && cards.length === 0) {
      setCards([...fetchedCards].sort(() => Math.random() - 0.5));
    }
  }, [fetchedCards, cards.length]);

  const handleNextCard = () => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
      setSelectedOption(null);
    } else {
      setFinished(true);
    }
  };

  const handleRate = async (quality: number) => {
    if (!cards[currentCardIndex]) return;
    
    try {
      await updateProgressMutation.mutateAsync({
        id: cards[currentCardIndex].id,
        quality
      });
      handleNextCard();
    } catch (err) {
      console.error(err);
      toast.error('保存进度失败');
    }
  };

  const handleOptionClick = (option: string) => {
    if (showAnswer) return;
    setSelectedOption(option);
    setShowAnswer(true);
  };

  const handleRestart = () => {
    setFinished(false);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setSelectedOption(null);
    
    if (fetchedCards) {
      // Re-shuffle
      setCards([...fetchedCards].sort(() => Math.random() - 0.5));
    } else {
      refetch();
    }
  };

  if (isLoading) return <div className="p-8 text-center">正在加载学习卡片...</div>;

  if (cards.length === 0) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">学习模式</h2>
        <p className="text-gray-600">该图谱没有找到学习卡片。请先添加一些节点并生成卡片！</p>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-green-600">本次学习完成!</h2>
        <p className="text-gray-600 mb-8">你已经复习了所有 {cards.length} 张卡片。</p>
        <button
          onClick={handleRestart}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 inline-flex items-center"
        >
          <RefreshCw className="mr-2" size={20} />
          开始新一轮学习
        </button>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];
  // Guard against index out of bounds if cards changed
  if (!currentCard) return null; 

  const isQA = !currentCard.card_type || currentCard.card_type === 'qa';
  const isChoice = currentCard.card_type === 'choice';
  const isTrueFalse = currentCard.card_type === 'true_false';

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 bg-gray-100">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">学习模式</h2>
          <span className="text-gray-500">
            进度 {currentCardIndex + 1} / {cards.length}
          </span>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 min-h-[400px] flex flex-col cursor-default transition-all hover:shadow-xl relative overflow-hidden">
          {/* Card Type Badge */}
          <div className="absolute top-4 right-4 text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-500 uppercase">
            {isQA ? '问答题' : isChoice ? '选择题' : '判断题'}
          </div>

          {/* Question Section */}
          <div className="flex-1 flex flex-col items-center justify-center text-center mb-8">
            <h3 className="text-gray-500 uppercase tracking-wide text-sm font-semibold mb-4">
              问题
            </h3>
            <p className="text-2xl font-medium text-gray-900">
              {currentCard.question}
            </p>
          </div>

          {/* Answer Section */}
          <div className="w-full">
            {isQA && (
              <div 
                className={`text-center transition-all duration-300 ${showAnswer ? 'opacity-100' : 'opacity-100'}`}
                onClick={() => !showAnswer && setShowAnswer(true)}
              >
                {showAnswer ? (
                  <div className="border-t pt-6">
                    <h3 className="text-gray-500 uppercase tracking-wide text-sm font-semibold mb-2">答案</h3>
                    <p className="text-xl text-gray-800">{currentCard.answer}</p>
                  </div>
                ) : (
                  <div className="py-8 cursor-pointer hover:bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">点击查看答案</p>
                  </div>
                )}
              </div>
            )}

            {isChoice && currentCard.options && (
              <div className="grid grid-cols-1 gap-3">
                {currentCard.options.map((option, idx) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = option === currentCard.answer;
                  
                  let btnClass = "p-4 rounded-lg border-2 text-left transition-all relative ";
                  if (showAnswer) {
                    if (isCorrect) btnClass += "bg-green-50 border-green-500 text-green-700";
                    else if (isSelected) btnClass += "bg-red-50 border-red-500 text-red-700";
                    else btnClass += "bg-gray-50 border-gray-200 text-gray-400";
                  } else {
                    btnClass += "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionClick(option)}
                      disabled={showAnswer}
                      className={btnClass}
                    >
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                      {option}
                      {showAnswer && isCorrect && <Check className="absolute right-4 top-4 text-green-600" size={20} />}
                      {showAnswer && isSelected && !isCorrect && <X className="absolute right-4 top-4 text-red-600" size={20} />}
                    </button>
                  );
                })}
              </div>
            )}

            {isTrueFalse && (
              <div className="flex space-x-4 justify-center">
                {['True', 'False'].map((option) => {
                  const isSelected = selectedOption === option;
                  const isCorrect = option === currentCard.answer;
                  
                  let btnClass = "flex-1 py-4 rounded-lg border-2 text-center font-bold text-lg transition-all relative ";
                  if (showAnswer) {
                     if (isCorrect) btnClass += "bg-green-50 border-green-500 text-green-700";
                     else if (isSelected) btnClass += "bg-red-50 border-red-500 text-red-700";
                     else btnClass += "bg-gray-50 border-gray-200 text-gray-400";
                  } else {
                    btnClass += "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer";
                  }

                  return (
                    <button
                      key={option}
                      onClick={() => handleOptionClick(option)}
                      disabled={showAnswer}
                      className={btnClass}
                    >
                      {option === 'True' ? '正确 / True' : '错误 / False'}
                      {showAnswer && isCorrect && <Check className="absolute right-4 top-4 text-green-600" size={20} />}
                      {showAnswer && isSelected && !isCorrect && <X className="absolute right-4 top-4 text-red-600" size={20} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rating Buttons - Show only after answer is revealed */}
        {showAnswer && (
          <div className="mt-8 grid grid-cols-4 gap-4 animate-fade-in-up">
            <button
              onClick={() => handleRate(1)}
              className="bg-red-100 text-red-700 py-3 rounded-lg font-medium hover:bg-red-200 transition-colors shadow-sm"
              disabled={updateProgressMutation.isPending}
            >
              重来 (Again)
            </button>
            <button
              onClick={() => handleRate(3)}
              className="bg-orange-100 text-orange-700 py-3 rounded-lg font-medium hover:bg-orange-200 transition-colors shadow-sm"
              disabled={updateProgressMutation.isPending}
            >
              困难 (Hard)
            </button>
            <button
              onClick={() => handleRate(4)}
              className="bg-blue-100 text-blue-700 py-3 rounded-lg font-medium hover:bg-blue-200 transition-colors shadow-sm"
              disabled={updateProgressMutation.isPending}
            >
              良好 (Good)
            </button>
            <button
              onClick={() => handleRate(5)}
              className="bg-green-100 text-green-700 py-3 rounded-lg font-medium hover:bg-green-200 transition-colors shadow-sm"
              disabled={updateProgressMutation.isPending}
            >
              简单 (Easy)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
