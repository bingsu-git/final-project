classDiagram
direction LR
class User { +userId +languageCode +chatHistory[] }
class Mistake { +userId +original +corrected +explanation +suppressed }
class QuizItem { +userId +prompt +answer +dueAt +sourceMistakeIds[] }
class ChatController
class QuizController
class GPTService
class GrammarChecker
class MongoDB
class OpenAI
class LanguageTool
class FlaskAnalyzer
class GoogleTTS

ChatController --> GPTService
ChatController --> GrammarChecker
QuizController --> QuizItem
QuizController --> GrammarChecker : (생성시 품질가드)
GPTService --> User
GPTService --> OpenAI
GrammarChecker --> FlaskAnalyzer
GrammarChecker --> LanguageTool
GrammarChecker --> OpenAI : 설명 생성
GrammarChecker --> Mistake
User --> MongoDB
Mistake --> MongoDB
QuizItem --> MongoDB
ChatController --> GoogleTTS : /speak

