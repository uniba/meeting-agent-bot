# Meeting Agent Bot

Google Meetの会議に参加して自律的に振る舞うAIエージェントボット。Recall.AIとOpenAI GPTを組み合わせて、リアルタイムで会議の内容を理解し、適切に応答します。

## 機能

- **自動会議参加**: Google MeetのURLを使用してボットが会議に参加
- **リアルタイム文字起こし**: Recall.ai Streamingを使用して会議の音声をリアルタイムでテキスト化
- **WebSocketストリーミング**: 低遅延のWebSocket接続で即座に文字起こしを受信
- **インテリジェントな応答**: トリガーフレーズを検出してAIが適切に応答
- **会議サマリー生成**: 定期的および会議終了時にサマリーを生成
- **アクションアイテム抽出**: 会議中のタスクや決定事項を自動抽出
- **カスタマイズ可能なペルソナ**: ボットの性格や役割を設定可能

## セットアップ

### 必要なAPI

1. **Recall.AI API Key**
   - [Recall.AI](https://recall.ai)でアカウントを作成
   - APIキーを取得

2. **OpenAI API Key**
   - [OpenAI](https://platform.openai.com)でアカウントを作成
   - APIキーを取得

### インストール

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してAPIキーを設定
```

### 文字起こし方式

このボットは**Recall.ai Streaming**を使用してリアルタイムで文字起こしを受信します。

#### Recall.ai Streamingの特徴
- **WebSocket接続**: 低遅延のリアルタイム通信
- **即座の文字起こし**: Webhookよりも高速に文字起こしを受信
- **ngrok不要**: ローカル開発でもngrokなしで文字起こしを受信可能

#### Webhook URL設定

Webhook URLは**ボットのステータス更新**（参加、退出など）を受信するために必要です。

##### ローカル開発の場合

ステータス更新を受信したい場合のみngrokが必要です：

1. **ngrokのインストール**
   ```bash
   # Homebrewの場合
   brew install ngrok

   # または https://ngrok.com/ からダウンロード
   ```

2. **ngrokの起動**
   ```bash
   ngrok http 3000
   ```

3. **WEBHOOK_URLの設定**
   - ngrokが表示するHTTPS URL（例：`https://abc123.ngrok.io`）をコピー
   - `.env`ファイルで以下のように設定：
   ```
   WEBHOOK_URL=https://abc123.ngrok.io/webhook
   ```

**注**: ステータス更新が不要な場合、ダミーのURLでも動作します（文字起こしはWebSocketで受信）：
```
WEBHOOK_URL=https://example.com/webhook
```

##### 本番環境の場合

公開サーバーのURLを使用：
```
WEBHOOK_URL=https://your-domain.com/webhook
```

### 起動

```bash
# 開発モード
npm run dev

# ビルド & 本番モード
npm run build
npm start
```

## 使用方法

### 1. 会議に参加

```bash
curl -X POST http://localhost:3000/join-meeting \
  -H "Content-Type: application/json" \
  -d '{
    "meetingUrl": "https://meet.google.com/xxx-xxxx-xxx",
    "botName": "AI Assistant"
  }'
```

### 2. メッセージ送信

```bash
curl -X POST http://localhost:3000/send-message/{botId} \
  -H "Content-Type: application/json" \
  -d '{
    "message": "こんにちは、AI Assistantです。会議のサポートをさせていただきます。"
  }'
```

### 3. 質問する

```bash
curl -X POST http://localhost:3000/ask-question/{botId} \
  -H "Content-Type: application/json" \
  -d '{
    "question": "これまでの議論の要点をまとめてください"
  }'
```

### 4. 会議から退出

```bash
curl -X POST http://localhost:3000/leave-meeting/{botId}
```

## APIエンドポイント

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | `/join-meeting` | 会議に参加 |
| POST | `/leave-meeting/:botId` | 会議から退出 |
| POST | `/send-message/:botId` | メッセージ送信 |
| POST | `/ask-question/:botId` | 質問する |
| GET | `/active-bots` | アクティブなボット一覧 |
| GET | `/transcript/:botId` | 文字起こし取得 |
| PUT | `/update-persona` | ペルソナ更新 |
| GET | `/health` | ヘルスチェック |

## トリガーフレーズ

ボットは以下のフレーズを検出すると自動的に応答します：
- AIアシスタント
- アシスタント
- ボット
- AI
- 質問があります
- ヘルプ

## カスタマイズ

### ペルソナの変更

```javascript
{
  "name": "プロジェクトマネージャーAI",
  "role": "プロジェクト進行のファシリテーター",
  "personality": "効率的で目標志向。タスクの明確化と期限管理を重視。",
  "knowledgeBase": "アジャイル開発、スクラム、プロジェクト管理のベストプラクティス"
}
```

## 注意事項

- Webhookを受信できるようにngrokなどを使用してローカルサーバーを公開する必要があります
- Recall.AIの制限により、同時に参加できる会議数に制限があります
- OpenAI APIの使用量に応じて課金が発生します

## トラブルシューティング

### ボットが会議に参加できない
- Google Meetの設定で外部参加者の許可を確認
- Recall.AI APIキーが正しいか確認
- 会議URLが有効か確認

### 文字起こしが取得できない

#### WebSocket接続の確認
1. **ストリーミング接続のログを確認**
   - サーバーログで以下が表示されているか確認：
     - `Creating bot with recallai_streaming provider`
     - `Streaming endpoint: wss://...`
     - `WebSocket connected for bot bot_xxx`
     - `Received streaming data for bot bot_xxx`

2. **接続失敗の場合**
   - ボットが会議に参加してから数秒後にWebSocket接続を試行
   - 失敗した場合、5秒後に自動リトライ
   - ログで`WebSocket error`や`Failed to connect to streaming`を確認

3. **Recall.AIのダッシュボードで確認**
   - [Recall.AI Dashboard](https://recall.ai/dashboard) でボットのステータスを確認
   - ボットが`in_call`状態か確認
   - `real_time_transcription.websocket_url`が存在するか確認

#### Webhook (ステータス更新) の確認
1. **Webhook URLが公開アクセス可能か確認**（オプション）
   - ローカル開発でステータス更新を受信したい場合のみ必要
   - `curl https://your-ngrok-url.ngrok.io/webhook` でアクセス可能か確認

2. **ログを確認**
   - サーバーのログで `Received webhook event: bot.status_change` が表示されているか確認

### 応答が生成されない
- OpenAI APIキーとクォータを確認
- トリガーフレーズが正しく検出されているか確認（ログを参照）

### デバッグのヒント

#### 正常動作時のログ例

サーバーを起動して会議に参加すると、以下のような情報が表示されます：

```bash
# ボット作成
Creating bot with recallai_streaming provider
Webhook URL for status updates: https://example.com/webhook
Bot created with ID: bot_abc123xyz
Streaming endpoint: wss://streaming.recall.ai/bot/bot_abc123xyz

# WebSocket接続
Connecting to streaming endpoint for bot bot_abc123xyz: wss://...
WebSocket connected for bot bot_abc123xyz
Streaming connected for bot bot_abc123xyz

# 文字起こし受信
Received streaming data for bot bot_abc123xyz: {...}
Partial transcript [Speaker 1]: こんに
Final transcript [Speaker 1]: こんにちは、皆さん

# Webhookでのステータス更新（ngrok使用時のみ）
Received webhook event: bot.status_change for bot bot_abc123xyz
Bot bot_abc123xyz status changed to: in_call_recording
```

#### 文字起こしが来ない場合のチェックリスト

1. ✅ `WebSocket connected for bot bot_xxx` が表示されている
2. ✅ ボットが会議に参加している（会議画面に表示されている）
3. ✅ 会議で誰かが話している
4. ✅ Recall.AIダッシュボードでボットが`in_call`状態

これらが全て満たされているのに文字起こしが来ない場合は、Recall.AIのサポートに問い合わせてください。

## ライセンス

ISC