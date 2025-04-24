
// index.js
require('dotenv').config();

// 테스트
// console.log("🔍 현재 MONGO_URI 값:", process.env.MONGO_URI);
// console.log("===== 내가 지금 새로 수정한 index.js가 실행되고 있음! =====");


const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');


const app = express();

// CORS 허용
app.use(cors());

// JSON 형식의 요청 바디를 해석하기 위한 설정
app.use(express.json());

app.use('/images', express.static('public/images'));


// ------------------ 1) MongoDB 연결  ------------------
const MONGO_URI = process.env.MONGO_URI;
// ↑ Atlas에서 복사한 URI (본인 것 사용)
// 보안상 실제론 process.env.MONGO_URI 등 환경변수 사용하는 게 좋음

mongoose.connect(MONGO_URI)
//   옜날 코드로 삭제 
// , {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
  .then(() => console.log('MongoDB 연결 성공!'))
  .catch((err) => console.error('MongoDB 연결 실패:', err));


// ------------------ 2) Mongoose Schema/Model  ------------------
// 예: 사용자 답안을 저장하는 Schema
const userAnswerSchema = new mongoose.Schema({
    email: String,
    answers: [Number],  // 예: [0, 3, 2]
    score: Number,
    createdAt: { type: Date, default: Date.now },
  });
  const UserAnswer = mongoose.model('UserAnswer', userAnswerSchema);
  


// 문제 & 정답 (서버가 전체 정보를 알고 있음)
const questions = [
    {
      id: 1,
      question: "images/problem1.png",
        choices: ["images/answer1-1.png", "images/answer1-2.png", "images/answer1-3.png", "images/answer1-4.png", "images/answer1-5.png"],
      correct: 0
    },
    {
      id: 2,
      question: "images/problem2.png",
      choices: ["images/answer1-1.png", "images/answer1-2.png", "images/answer1-3.png", "images/answer1-4.png", "images/answer1-5.png"],
      correct: 0
    },
    {
      id: 3,
      question: "images/problem3.png",
      choices: ["images/answer1-1.png", "images/answer1-2.png", "images/answer1-3.png", "images/answer1-4.png", "images/answer1-5.png"],
      correct: 0
    },
  ];
  
// 내부 점수 계산 로직 (예시)
// - 모두 맞으면 10점
// - 하나 틀리면 5점
// - 두 개 틀리면 2점
// - 그 외: 0점
function getInternalScore(correctCount, total) {
    if (correctCount === total) return 10;
    if (correctCount === total - 1) return 5;
    if (correctCount === total - 2) return 2;
    return 0;
  }

// ------------------ 4) 엔드포인트: /submit  ------------------

// 채점 + 이메일 발송 엔드포인트
app.post('/submit', async (req, res) => {
  try {
    // 클라이언트(프론트엔드)에서 보낸 데이터 구조 예시:
    // {
    //   email: "user@example.com",
    //   answers: [0, 3, 2]  // 사용자가 선택한 객관식 인덱스
    // }

    console.log("✅ /submit 요청 도착!");
    
    const { email, answers } = req.body;
    const baseURL = process.env.BASE_URL;



    // (1) 채점 로직
    let correctCount = 0;
    let wrongAnswers = [];

  for (let i = 0; i < questions.length; i++) {
    if (answers[i] === questions[i].correct) {
      correctCount++;
    } else {
      // 틀린 문제를 이미지 URL 기반으로 저장
      wrongAnswers.push({
        questionNumber: i + 1, 
        questionImage: `${baseURL}/${questions[i].question}`, // 👈 이렇게!
        correctChoiceImage: `${baseURL}/${questions[i].choices[questions[i].correct]}`      
      });
    }
  }

  const internalScore = getInternalScore(correctCount, questions.length);

  await UserAnswer.create({ email, answers, score: correctCount });

  let emailHTML = `<h2>당신의 점수는 ${correctCount}/${questions.length} 입니다.</h2>`;
  emailHTML += `<h3>내부 점수: ${internalScore}</h3>`;

  if (wrongAnswers.length > 0) {
    emailHTML += `<h3>틀린 문제 정답 안내:</h3>`;
    wrongAnswers.forEach((item) => {
      emailHTML += `
        <div>
          <h4>Q${item.questionNumber}</h4>
          <img src="${item.questionImage}" alt="문제 이미지" style="width: 300px; display: block;">
          <p>정답:</p>
          <img src="${item.correctChoiceImage}" alt="정답 이미지" style="width: 150px; display: block;">
        </div>
        <hr>
      `;
    });
  } else {
    emailHTML += `<p>모든 문제를 맞추셨습니다! 축하드립니다.</p>`;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

console.log("=== 현재 questions 배열 ===", questions);
console.log("📧 이메일 HTML 확인용 =====");
console.log(emailHTML);


  await transporter.sendMail({ from: process.env.MAIL_USER, to: email, subject: '테스트 결과', html: emailHTML });

  res.json({ 
    message: '이메일 전송 완료!',
    score: correctCount,
    internalScore: internalScore });

} catch (err) {
  console.error(err);
  res.status(500).json({ error: '서버 에러 발생' });
}
});


// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`서버가 실행 중: http://localhost:${PORT}`);
});


