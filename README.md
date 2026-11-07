# May_Attorney

HTML로 만드는 법정 추리 비주얼노벨 게임.

## 폴더 구조

```
index.html        게임 화면과 엔진
text/             장면별 대사 파일 (scene01.txt, scene02.txt ...)
img/bg/           배경 이미지 (예: office.png)
img/char/         캐릭터 이미지 (캐릭터_표정.png, 예: 메이_nervous.png)
```

## 실행 방법

`index.html`을 더블클릭하면 브라우저 보안 정책 때문에 대사 파일을 읽을 수 없습니다.
아래 방법 중 하나로 로컬 서버를 통해 열어 주세요.

### VS Code에서 테스트 (추천)

1. VS Code에서 이 폴더를 엽니다. (`파일 → 폴더 열기`)
2. 오른쪽 아래에 **"권장 확장 설치"** 알림이 뜨면 **설치**를 누릅니다.
   (안 뜨면 확장 탭에서 `Live Server`를 검색해 설치)
3. 오른쪽 아래 상태 표시줄의 **Go Live** 버튼을 누릅니다.
   → 브라우저에서 http://localhost:5500 이 열리며 게임이 시작됩니다.
4. `text/*.txt` 대사 파일이나 `index.html`을 수정하고 저장하면 **브라우저가 자동으로 새로고침**됩니다.

#### 중단점 디버깅 (선택)

Go Live를 켜 둔 상태에서 `F5` → **게임 디버그 (Chrome)** 또는 **(Edge)** 를 고르면
VS Code에서 `index.html`의 스크립트에 중단점을 걸고 디버깅할 수 있습니다.

### 터미널에서 테스트

```bash
python -m http.server 8000
```

그 다음 http://localhost:8000 에 접속합니다.

## 대사 파일 작성 규칙

```
# 주석
@bg office                          배경 변경 → img/bg/office.png
메이|nervous: 오늘이 첫 재판이네요.   캐릭터|표정: 대사
선배: 표정을 생략하면 normal          → img/char/선배_normal.png
@choice 네=scene02 | 아니요=scene03  선택지 (보기=이동할 장면)
@goto scene02                       다음 장면으로 이동
@end                                게임 끝
```

시작 장면은 `index.html`의 `START_SCENE`에서 바꿀 수 있습니다.
