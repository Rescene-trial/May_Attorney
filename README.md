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
| `@bg office` | 배경 변경 → `img/bg/office.png` (`@bg none`: 검은 화면) |
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

## 현재 필요한 이미지 목록

그리는 대로 아래 이름으로 넣으면 됩니다. 말하는 프레임(`_talk`)은 선택이에요.

| 캐릭터 | 사용하는 표정 |
|---|---|
| 메이 | normal, nervous, thinking, serious, confident, shock, smile |
| 선배 | normal, smile |
| 박지호 | normal, sad, thinking, shock |
| 재판장 | normal, serious |
| 서진혁 | normal, smile, serious, shock |
| 김만수 | normal, confident, nervous, shock, sad |

- 배경: `office`, `visit`, `apartment`, `court`
- 증거: `case_file`, `watch_photo`, `blackout_notice`
- 배경음악: `office`, `trial` / 효과음: `get`, `objection`, `damage`
