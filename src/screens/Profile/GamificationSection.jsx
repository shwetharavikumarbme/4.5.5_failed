import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import Lottie from 'lottie-react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GamificationSection = ({ onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [score, setScore] = useState(0);
  const [scaleAnim] = useState(new Animated.Value(1));
  const [badgeUnlocked, setBadgeUnlocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Sample questions
  const questions = [
    {
      question: "What's the best time to follow up after an interview?",
      options: [
        "Immediately after leaving",
        "Within 24 hours",
        "After 3-5 business days",
        "Never follow up"
      ],
      correctAnswer: 2
    },
    {
      question: "Which section should be the most prominent on your resume?",
      options: [
        "Hobbies",
        "Work Experience",
        "References",
        "Personal Photo"
      ],
      correctAnswer: 1
    }
  ];

  const animateProgress = (newValue) => {
    Animated.timing(progressAnim, {
      toValue: newValue,
      duration: 1000,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false
    }).start();
  };
  const saveGamificationData = async (score, badgeStatus) => {
    try {
      const data = {
        score,
        badgeUnlocked: badgeStatus,
        lastUpdated: new Date().toISOString()
      };
      await AsyncStorage.setItem('gamificationData', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save gamification data', error);
    }
  };
  
  const handleAnswer = (selectedOption) => {
    if (selectedOption === questions[currentQuestion].correctAnswer) {
      // Correct answer animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();

      setShowConfetti(true);
      setScore(score + 10);
      
      // Check if user earned a badge
      const newScore = score + 10;
      const earnedBadge = newScore >= 20 && !badgeUnlocked;
      
      setScore(newScore);
      if (earnedBadge) setBadgeUnlocked(true);
      
      // Save to AsyncStorage
      saveGamificationData(newScore, earnedBadge || badgeUnlocked);
  

      // Update progress
      const newProgress = ((currentQuestion + 1) / questions.length) * 100;
      setProgress(newProgress);
      animateProgress(newProgress);

      setTimeout(() => {
        setShowConfetti(false);
        if (currentQuestion < questions.length - 1) {
          setCurrentQuestion(currentQuestion + 1);
        } else {
          setQuizCompleted(true);
          if (onComplete) onComplete(score, badgeUnlocked);
        }
      }, 1500);
    } else {
      // Incorrect answer feedback
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true
        })
      ]).start();
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%']
  });

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setScore(0);
    setProgress(0);
    setQuizCompleted(false);
    progressAnim.setValue(0);
  };

  return (
    <View style={styles.gamificationContainer}>
      {quizCompleted ? (
        <View style={styles.completionContainer}>
          <Lottie
            source={require('../../assets/lottie/winner.json')}
            autoPlay
            loop={false}
            style={styles.completionAnimation}
          />
          <Text style={styles.completionTitle}>Daily Quiz Completed!</Text>
          <Text style={styles.completionScore}>+{score} points earned</Text>
          
          {badgeUnlocked && (
            <View style={styles.badgeContainer}>
              <Icon name="verified" size={24} color="#FFD700" />
              <Text style={styles.badgeText}>Career Expert Badge</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={resetQuiz}
          >
            <Text style={styles.actionButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.sectionTitle}>Daily Career Quiz</Text>
            <View style={styles.scoreContainer}>
              <Icon name="star" size={16} color="#FFD700" />
              <Text style={styles.scoreText}>{score}</Text>
            </View>
          </View>
          
          <View style={styles.progressBarContainer}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>
          
          <View style={styles.quizCard}>
            <Text style={styles.questionText}>
              {questions[currentQuestion].question}
            </Text>
            
            {questions[currentQuestion].options.map((option, index) => (
              <Animated.View 
                key={index}
                style={[styles.optionButton, { transform: [{ scale: scaleAnim }] }]}
              >
                <TouchableOpacity onPress={() => handleAnswer(index)}>
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </>
      )}
      
      {showConfetti && (
        <ConfettiCannon 
          count={200} 
          origin={{x: -10, y: 0}} 
          fadeOut={true}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  gamificationContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#075cab',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#EEEEEE',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#075cab',
    borderRadius: 3,
  },
  quizCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 14,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  optionButton: {
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#D0E3FF',
  },
  optionText: {
    fontSize: 14,
    color: '#075cab',
    textAlign: 'center',
  },
  completionContainer: {
    alignItems: 'center',
    padding: 8,
  },
  completionAnimation: {
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  completionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#075cab',
    marginBottom: 4,
  },
  completionScore: {
    fontSize: 16,
    color: '#4CAF50',
    marginBottom: 12,
    fontWeight: '500',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFD54F',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
    marginLeft: 6,
  },
  actionButton: {
    backgroundColor: '#075cab',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default GamificationSection;