# NES 游戏服务器 API 文档

## 基础信息

- 基础 URL: `http://localhost:8080`
- 所有接口返回格式为 JSON
- 响应格式统一为:
```json
{
  "code": 0,
  "data": {},
  "msg": "success"
}
```

## 认证说明

需要认证的接口需要在请求头中携带认证信息。具体认证方式由 `GetUserID` 函数实现决定。

认证成功后，用户ID会被存储在请求上下文中。

---

## 游戏相关接口（公开）

### 1. 根据ID查找游戏

**接口**: `GET /api/games/:id`

**描述**: 根据游戏ID获取游戏详细信息，同时会增加该游戏的点击量

**请求参数**:
- Path 参数:
  - `id` (int, 必填): 游戏ID

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "game_id": 1,
    "title": "Super Mario Bros",
    "type": "NES",
    "binary_file": "mario.nes",
    "region": "US",
    "language": "EN",
    "title_screen_image": "https://...",
    "game_uid": "mario-001",
    "game_binary_file": "https://...",
    "title_screen_image1": "https://..."
  },
  "msg": "success"
}
```

---

### 2. 搜索游戏

**接口**: `GET /api/games/search`

**描述**: 根据游戏名称搜索游戏（支持模糊搜索）

**请求参数**:
- Query 参数:
  - `title` (string, 必填): 游戏名称（支持部分匹配）

**请求示例**:
```
GET /api/games/search?title=mario
```

**响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "game_id": 1,
      "title": "Super Mario Bros",
      "type": "NES",
      "binary_file": "mario.nes",
      "region": "US",
      "language": "EN",
      "title_screen_image": "https://...",
      "game_uid": "mario-001",
      "game_binary_file": "https://...",
      "title_screen_image1": "https://..."
    }
  ],
  "msg": "success"
}
```

---

### 3. 获取所有游戏类型 ⭐新增

**接口**: `GET /api/games/types`

**描述**: 获取数据库中所有游戏平台类型（去重，带缓存30分钟）

**请求参数**: 无

**请求示例**:
```
GET /api/games/types
```

**响应示例**:
```json
{
  "code": 0,
  "data": [
    "NES",
    "SNES",
    "GBA",
    "GB"
  ],
  "msg": "success"
}
```

**说明**:
- 自动去重
- 结果按字母排序
- 使用缓存，30分钟过期
- 排除空字符串类型

---

### 4. 根据平台类型获取游戏列表（分页）

**接口**: `GET /api/games/type`

**描述**: 根据游戏平台类型获取游戏列表，支持分页，每页默认10条

**请求参数**:
- Query 参数:
  - `type` (string, 必填): 游戏平台类型（如：NES, SNES, GBA等）
  - `page` (int, 可选, 默认1): 页码
  - `page_size` (int, 可选, 默认10): 每页数量（最大100）
  - `language` (string, 可选): 游戏语言（如：EN, JP, CN等）

**请求示例**:
```
GET /api/games/type?type=NES&page=1&page_size=10
GET /api/games/type?type=NES&language=EN&page=1&page_size=10
```

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "games": [
      {
        "game_id": 1,
        "title": "Super Mario Bros",
        "type": "NES",
        "binary_file": "mario.nes",
        "region": "US",
        "language": "EN",
        "title_screen_image": "https://...",
        "game_uid": "mario-001",
        "game_binary_file": "https://...",
        "title_screen_image1": "https://..."
      }
    ],
    "total": 100,
    "page": 1,
    "page_size": 10
  },
  "msg": "success"
}
```

---

### 5. 获取推荐游戏列表

**接口**: `GET /api/games/recommend`

**描述**: 获取推荐游戏列表（基于点击量推荐）

**请求参数**:
- Query 参数:
  - `limit` (int, 可选, 默认20): 数量限制（最大100）

**请求示例**:
```
GET /api/games/recommend?limit=20
```

**响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "game_id": 1,
      "title": "Super Mario Bros",
      "type": "NES",
      "binary_file": "mario.nes",
      "region": "US",
      "language": "EN",
      "title_screen_image": "https://...",
      "game_uid": "mario-001",
      "game_binary_file": "https://...",
      "title_screen_image1": "https://...",
      "click_count": 1000
    }
  ],
  "msg": "success"
}
```

---

### 6. 获取游戏点击量排行榜

**接口**: `GET /api/games/ranking`

**描述**: 获取游戏点击量排行榜

**请求参数**:
- Query 参数:
  - `limit` (int, 可选, 默认50): 数量限制（最大100）

**请求示例**:
```
GET /api/games/ranking?limit=50
```

**响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "game_id": 1,
      "title": "Super Mario Bros",
      "type": "NES",
      "binary_file": "mario.nes",
      "region": "US",
      "language": "EN",
      "title_screen_image": "https://...",
      "game_uid": "mario-001",
      "game_binary_file": "https://...",
      "title_screen_image1": "https://...",
      "click_count": 1000
    }
  ],
  "msg": "success"
}
```

---

## 用户相关接口（需要认证）

### 7. 添加收藏

**接口**: `POST /api/user/favorites`

**描述**: 添加游戏到收藏列表

**认证**: 需要

**请求体**:
```json
{
  "game_id": 1
}
```

**响应示例**:
```json
{
  "code": 0,
  "msg": "收藏成功"
}
```

---

### 7. 移除收藏

**接口**: `DELETE /api/user/favorites/:game_id`

**描述**: 从收藏列表中移除游戏

**认证**: 需要

**请求参数**:
- Path 参数:
  - `game_id` (int, 必填): 游戏ID

**响应示例**:
```json
{
  "code": 0,
  "msg": "取消收藏成功"
}
```

---

### 8. 获取用户收藏列表

**接口**: `GET /api/user/favorites`

**描述**: 获取当前用户的收藏列表

**认证**: 需要

**响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "game_id": 1,
      "title": "Super Mario Bros",
      "type": "NES",
      "binary_file": "mario.nes",
      "region": "US",
      "language": "EN",
      "title_screen_image": "https://...",
      "game_uid": "mario-001",
      "game_binary_file": "https://...",
      "title_screen_image1": "https://..."
    }
  ],
  "msg": "success"
}
```

---

### 9. 检查是否已收藏

**接口**: `GET /api/user/favorites/:game_id/check`

**描述**: 检查指定游戏是否已被收藏

**认证**: 需要

**请求参数**:
- Path 参数:
  - `game_id` (int, 必填): 游戏ID

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "is_favorite": true
  },
  "msg": "success"
}
```

---

### 10. 添加游戏历史

**接口**: `POST /api/user/history`

**描述**: 添加游戏历史记录

**认证**: 需要

**请求体**:
```json
{
  "game_id": 1,
  "play_time": "30分钟"
}
```

**响应示例**:
```json
{
  "code": 0,
  "msg": "添加历史成功"
}
```

---

### 11. 获取用户游戏历史

**接口**: `GET /api/user/history`

**描述**: 获取用户的游戏历史记录

**认证**: 需要

**请求参数**:
- Query 参数:
  - `limit` (int, 可选, 默认50): 数量限制（最大100）

**请求示例**:
```
GET /api/user/history?limit=50
```

**响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "game_id": 1,
      "title": "Super Mario Bros",
      "type": "NES",
      "binary_file": "mario.nes",
      "region": "US",
      "language": "EN",
      "title_screen_image": "https://...",
      "game_uid": "mario-001",
      "game_binary_file": "https://...",
      "title_screen_image1": "https://..."
    }
  ],
  "msg": "success"
}
```

---

### 12. 上传游戏存档

**接口**: `POST /api/user/saves`

**描述**: 上传游戏存档文件到 S3

**认证**: 需要

**请求类型**: `multipart/form-data`

**请求参数**:
- Form 参数:
  - `game_id` (int, 必填): 游戏ID
  - `save_file` (file, 必填): 存档文件（bin格式）

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "save_url": "https://s3.amazonaws.com/bucket/save-file.bin"
  },
  "msg": "上传成功"
}
```

---

### 13. 获取指定游戏存档

**接口**: `GET /api/user/saves/:game_id`

**描述**: 获取用户指定游戏的存档信息

**认证**: 需要

**请求参数**:
- Path 参数:
  - `game_id` (int, 必填): 游戏ID

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "user_id": "user123",
    "game_id": 1,
    "save_file": "https://s3.amazonaws.com/bucket/save-file.bin",
    "create_time": "2025-01-01 12:00:00",
    "update_time": "2025-01-02 15:30:00"
  },
  "msg": "success"
}
```

---

### 14. 获取用户所有游戏存档

**接口**: `GET /api/user/saves`

**描述**: 获取用户的所有游戏存档列表

**认证**: 需要

**响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "user_id": "user123",
      "game_id": 1,
      "save_file": "https://s3.amazonaws.com/bucket/save-file.bin",
      "create_time": "2025-01-01 12:00:00",
      "update_time": "2025-01-02 15:30:00"
    }
  ],
  "msg": "success"
}
```

---

### 15. 删除游戏存档

**接口**: `DELETE /api/user/saves/:game_id`

**描述**: 删除指定游戏的存档

**认证**: 需要

**请求参数**:
- Path 参数:
  - `game_id` (int, 必填): 游戏ID

**响应示例**:
```json
{
  "code": 0,
  "msg": "删除成功"
}
```

---

## 其他接口

### 健康检查

**接口**: `GET /health`

**描述**: 服务健康检查

**响应示例**:
```json
{
  "status": "ok"
}
```

---

## 错误码说明

- `code: 0` - 成功
- HTTP 状态码:
  - `200` - 成功
  - `400` - 请求参数错误
  - `401` - 未授权
  - `404` - 资源不存在
  - `500` - 服务器内部错误

---

## 注意事项

1. 所有需要认证的接口必须在请求中携带有效的认证信息
2. 上传存档文件需要使用 `multipart/form-data` 格式
3. 游戏点击量会在访问游戏详情时自动增加
4. 分页接口默认每页10条，最大100条
5. 文件上传到 AWS S3，需要正确配置 S3 相关参数

---

## 数据库表说明

系统使用以下数据库表：

1. **games** - 游戏信息表（主表）
2. **user_favorites** - 用户收藏表
3. **user_history** - 用户游戏历史表
4. **game_saves** - 游戏存档表
5. **game_clicks** - 游戏点击量表

所有用户相关的表会在系统启动时自动创建。

