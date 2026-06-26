# 릴리즈 프로세스

운영 배포는 `master` 브랜치 push가 아니라 릴리즈 태그 push로만 진행한다.

## 정책

- `master` 브랜치는 개발 완료분을 모으는 기본 브랜치로 사용한다.
- Vercel Git 자동 배포는 `vercel.json`의 `git.deploymentEnabled: false`로 비활성화한다.
- `v*` 형식의 Git 태그가 push되면 GitHub Actions가 Vercel Production 배포를 실행한다.
- 태그는 되도록 `v0.1.0`, `v0.1.1`처럼 의미 있는 버전으로 만든다.

## 최초 설정

GitHub 저장소의 `Settings → Secrets and variables → Actions → Secrets`에 아래 값을 등록한다.

| 이름 | 용도 |
| --- | --- |
| `VERCEL_TOKEN` | GitHub Actions에서 Vercel CLI를 실행하기 위한 토큰 |
| `VERCEL_ORG_ID` | Vercel 팀 또는 개인 계정 ID |
| `VERCEL_PROJECT_ID` | Vercel 프로젝트 ID |

`VERCEL_ORG_ID`와 `VERCEL_PROJECT_ID`는 로컬에서 `vercel link`를 실행하면 생성되는 `.vercel/project.json`에서 확인할 수 있다. 이 파일은 개인 환경 파일이므로 저장소에 커밋하지 않는다.

## 릴리즈 방법

```bash
git checkout master
git pull origin master
npm run lint
npm run build
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

태그가 push되면 GitHub Actions의 **태그 기반 프로덕션 배포** 워크플로가 실행된다.

## 운영 배포 전 확인 항목

- Lighthouse 모바일 점수가 급격히 떨어지지 않았는가?
- `/api/weather?date=YYYYMMDD`가 정상 응답하는가?
- `/api/games`가 정상 응답하는가?
- `/api/cron/weather` 수동 실행이 성공하는가?
- Vercel 배포 로그에 환경 변수 누락이나 빌드 오류가 없는가?

## 롤백

Vercel 대시보드에서 이전 정상 Production Deployment를 선택해 **Promote to Production** 또는 Rollback을 실행한다.

긴급 수정이 필요하면 새 커밋을 `master`에 반영한 뒤 패치 태그를 생성한다.

```bash
git tag -a v0.1.1 -m "v0.1.1"
git push origin v0.1.1
```
