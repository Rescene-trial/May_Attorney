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
로컬 서버로 열어 주세요.

```bash
python -m http.server 8000
```

그 다음 http://localhost:8000 에 접속합니다. (VS Code의 Live Server 확장을 써도 됩니다.)

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
