# May_Attorney

HTML로 만드는 법정 추리 비주얼노벨 게임.
대사는 모두 `text/` 폴더의 텍스트 파일로 관리합니다.

## 폴더 구조

```
index.html          게임 화면
css/style.css       디자인
js/engine.js        게임 엔진 (설정은 파일 맨 위 CONFIG)
text/               장면별 대사 파일
  scene01.txt         사무소 (선택지)
  scene01_review.txt  선택지 분기
  scene02.txt         구치소 면회
  scene03.txt         아파트 조사 (증거 획득)
  scene04_trial.txt   첫 번째 재판 (증거 제시, 반대신문)
  gameover.txt        HP가 0이 되면 오는 장면
img/bg/             배경 이미지       이름.png
img/char/           캐릭터 이미지     캐릭터_표정.png, 캐릭터_표정_talk.png
img/evidence/       증거 이미지       증거아이디.png
audio/bgm/          배경음악          이름.mp3
audio/se/           효과음            이름.mp3
```

**이미지와 사운드는 없어도 게임이 돌아갑니다.**
캐릭터 이미지가 없으면 이름과 표정이 적힌 임시 실루엣이, 배경이 없으면 색 배경이 나옵니다.
그림을 하나씩 그려 넣는 대로 자동으로 바뀝니다.

## 실행 방법

`index.html`을 더블클릭하면 브라우저 보안 정책 때문에 대사 파일을 읽을 수 없습니다.
아래 방법 중 하나로 로컬 서버를 통해 열어 주세요.

### VS Code에서 테스트 (추천)

1. VS Code에서 이 폴더를 엽니다. (`파일 → 폴더 열기`)
2. 오른쪽 아래에 **"권장 확장 설치"** 알림이 뜨면 **설치**를 누릅니다.
   (안 뜨면 확장 탭에서 `Live Server`를 검색해 설치)
3. 오른쪽 아래 상태 표시줄의 **Go Live** 버튼을 누릅니다.
   → 브라우저에서 http://localhost:5500 이 열리며 게임이 시작됩니다.
4. `text/*.txt` 대사 파일이나 코드를 수정하고 저장하면 **브라우저가 자동으로 새로고침**됩니다.

#### 중단점 디버깅 (선택)

Go Live를 켜 둔 상태에서 `F5` → **게임 디버그 (Chrome)** 또는 **(Edge)** 를 고르면
VS Code에서 `js/engine.js`에 중단점을 걸고 디버깅할 수 있습니다.

### 터미널에서 테스트

```bash
python -m http.server 8000
```

그 다음 http://localhost:8000 에 접속합니다.

## 조작

| 입력 | 동작 |
|---|---|
| 클릭 / Space / Enter | 대사 진행 (글자 출력 중이면 한 번에 표시) |
| E | 법정기록 (증거 목록) |
| L | 대사기록 |
| ← → | 반대신문 중 이전/다음 증언 |
| Esc | 창 닫기 |

장면이 바뀔 때마다 자동 저장되며, 타이틀의 **이어하기**로 이어서 할 수 있습니다.

## 대사 파일 작성 규칙

### 기본

```
# 주석 (게임에 안 나옴)
메이|nervous: 오늘이 첫 재판이네요.      캐릭터|표정: 대사
선배: 표정을 생략하면 normal             → img/char/선배_normal.png
메이|thinking: (속마음은 괄호로)          파란 글씨, 입이 안 움직임
: 이름 없는 서술 문장                    콜론으로 시작
*라벨이름                                 이동 지점 표시
```

### 명령어

| 명령어 | 설명 |
|---|---|
| `@bg office` | 배경 변경 → `img/bg/office.png` (`@bg none`: 검은 화면). 장소가 바뀌므로 캐릭터도 지워짐 |
| `@player hide` / `@player show` | 플레이어 시점 / 법정 모드 (아래 설명) |
| `@chars hide` / `@chars show` | 상황 설명 모드: 배경만 보이고 모든 캐릭터 그림 숨김 / 다시 보이기 (아래 설명) |
| `@show 김만수\|normal` / `@hide` | 대사 없이 캐릭터 표시 / 숨기기 |
| `@title 5월 7일 / 지방법원` | 날짜·장소 카드 (`/`는 줄바꿈) |
| `@bgm trial` / `@bgm stop` | 배경음악 재생 / 정지 → `audio/bgm/trial.mp3` |
| `@se get` | 효과음 → `audio/se/get.mp3` |
| `@shake` / `@shake big` | 화면 흔들기 |
| `@flash` / `@flash red` | 화면 번쩍임 |
| `@objection 이의 있음!` | 큰 글씨 외침 연출 (+ 효과음 `objection`) |
| `@wait 1000` | 잠깐 멈춤 (밀리초) |
| `@goto scene02` | 이동: `장면` / `#라벨` / `장면#라벨` |
| `@choice 네=scene02 \| 아니요=#no` | 선택지 |
| `@evidence add 아이디 이름 \| 설명` | 증거 추가 (`@evidence remove 아이디`: 삭제) |
| `@hp show` / `hide` / `reset` | 재판 HP(신뢰도) 표시 / 숨김 / 회복 |
| `@penalty 1` | HP 감소. 0이 되면 `gameover.txt` 로 이동 |
| `@present 증거=#정답 \| wrong=#오답` | 증거 제시 요구 |
| `@return` | 추궁·오답 장면이 끝나고 원래 자리로 돌아감 |
| `@end 다음 화에 계속` | 끝 문구 표시 후 타이틀로 |
| `@totitle` | 바로 타이틀로 |

### 플레이어 시점

- 기본은 **플레이어 시점(`@player hide`)** 입니다. 메이가 말해도 메이 그림은 나오지 않고,
  **대화 상대의 그림이 그대로 유지**되어 플레이어가 직접 상대와 대화하는 느낌을 줍니다.
- 법정에서는 `@player show` 로 바꿔서 메이도 화면에 나오게 합니다. (`scene04_trial.txt` 참고)
- 플레이어 캐릭터 이름은 `js/engine.js` 의 `CONFIG.PLAYER` 에서 바꿀 수 있습니다.

### 상황 설명 장면 (배경만 보여주기)

배경 그림으로 상황을 보여주는 장면에서는 `@chars hide` 를 씁니다.
대사의 이름 칸은 그대로 나오지만 캐릭터 그림은 나오지 않습니다. 끝나면 `@chars show` 로 되돌립니다.

```
@chars hide
@bg night_hallway                   ← img/bg/night_hallway.png
: 5월 3일 밤 11시. 한빛아파트 3층 복도.
: 정전으로 복도는 칠흑같이 어두웠다.
김만수: (어라, 누가 302호에서 나오는데...)    ← 이름만 나오고 그림은 안 나옴
@chars show
@bg court
재판장: 증인, 계속하세요.                     ← 다시 그림이 나옴
```

- `@chars hide` 중에도 `@show 이름|표정` 으로 직접 띄우는 건 됩니다.
- 장면이 바뀌어도 `@chars show` 를 쓰기 전까지 계속 숨김 상태이니, 설명이 끝나면 꼭 되돌려 주세요.

### 반대신문

```
@cross 증언 제목 | wrong=#wrong
김만수: 첫 번째 증언 [press=#p1]
김만수: 모순이 있는 증언 [press=#p2] [present=blackout_notice:#contradiction]
@endcross

*p1
메이: 추궁하는 대사...
@return                     ← 다음 증언으로 돌아감

*wrong
재판장: 관계없는 증거군요.
@penalty 1
@return

*contradiction
@objection 이의 있음!
메이: 모순을 찌르는 대사...  ← 여기서부터 이야기 계속
```

- `[press=#라벨]`: [추궁하기]를 누르면 갈 곳
- `[present=증거아이디:#라벨]`: 그 증거를 제시하면 갈 곳 (정답)
- 정답이 아닌 증거를 제시하면 `wrong=` 으로 지정한 곳으로 감
- 마지막 증언 다음은 다시 첫 증언으로 돌아감

## 캐릭터 그림 규칙 (자연스러운 움직임)

기본 그림 한 장만 있어도 됩니다. 아래 그림을 더 넣을수록 자연스러워집니다.

| 파일 | 용도 |
|---|---|
| `메이_nervous.png` | 기본 (눈 뜨고 입 다문 그림) — **필수** |
| `메이_nervous_talk1.png`, `_talk2.png`, `_talk3.png` | 말할 때 입 모양 (조금 벌림 / 크게 벌림 / 오므림 등). 1장만 있어도 되고 `_talk.png` 이름도 됨 |
| `메이_nervous_blink.png` | 눈 감은 그림 |
| `메이_nervous_blink_half.png` | 눈 반쯤 감은 그림 (있으면 깜빡임이 더 부드러움) |

- 모든 그림은 **기본 그림을 복사해서 입이나 눈만 고친 것**이어야 합니다. 크기와 위치가 똑같아야 해요.
- 입은 글자가 나올 때만 움직이고, 띄어쓰기·문장부호(`, . ! ? …`)에서 쉬는 동안엔 닫힙니다.
  입 모양은 매번 무작위로 골라서 기계적인 반복처럼 보이지 않게 합니다.
- 눈은 2~5.5초마다 무작위로 깜빡이고, 가끔 두 번 연속 깜빡입니다.
- 말하는 동안 고개가 살짝 끄덕이고 기울어지며, 문장부호에서 쉴 때 제자리로 돌아옵니다.
- 속도와 간격은 `js/engine.js` 의 `CONFIG` (`TYPE_SPEED`, `PUNCT_PAUSE`, `MOUTH_MS`, `BLINK_MIN_MS`, `BLINK_MAX_MS`)에서,
  고개 움직임 크기는 `TALK_BOB_PX`(위아래 px), `TALK_TILT_DEG`(기울기 각도)에서 조절합니다. 0으로 하면 꺼집니다.

## 현재 필요한 이미지 목록

그리는 대로 아래 이름으로 넣으면 됩니다. 입 모양·눈 깜빡임 그림은 선택이에요.

| 캐릭터 | 사용하는 표정 |
|---|---|
| 메이 | nervous, confident, serious, shock (법정 장면에서만 쓰임) |
| 선배 | normal, smile |
| 박지호 | normal, sad, thinking, shock |
| 재판장 | normal, serious |
| 서진혁 | normal, smile, serious, shock |
| 김만수 | normal, confident, nervous, shock, sad |

- 배경: `office`, `visit`, `apartment`, `court`
- 증거: `case_file`, `watch_photo`, `blackout_notice`
- 배경음악: `office`, `trial` / 효과음: `get`, `objection`, `damage`
