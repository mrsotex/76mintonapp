// =============================================
      // Supabase 설정
      // Supabase 대시보드 → Project Settings → API 에서 복사
      // =============================================
      const SUPABASE_URL = 'https://jcthdhhwydwbnppwzzey.supabase.co';
      const SUPABASE_ANON_KEY = 'sb_publishable_vF4WX27TEGBARd9Cx8ah_g_gRtfjwrx';
      const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      let people = [];
      let pool = [];
      let courts = [];
      let courtCount = 0;
      let nextId = 1;
      let draggedId = null;
      let selectedId = null; // 클릭 선택된 대기 인원 ID

      /* ── 클릭 선택 관련 함수 ── */
      function deselectAll() {
        selectedId = null;
        document.body.classList.remove('has-selection');
        document.querySelectorAll('.p-badge.selected, .member-chip.selected').forEach(function (el) {
          el.classList.remove('selected');
        });
      }

      function onClickPoolBadge(personId) {
        if (selectedId === personId) {
          deselectAll();
          return;
        }
        deselectAll();
        selectedId = personId;
        document.body.classList.add('has-selection');
        const el = document.querySelector('.p-badge[data-id="' + personId + '"]');
        if (el) el.classList.add('selected');
      }

      function onClickSlot(courtIdx, team) {
        if (selectedId === null) return;
        const person = people.find(function (p) {
          return p.id === selectedId;
        });
        if (!person) {
          deselectAll();
          return;
        }
        const court = courts[courtIdx];
        if (!court) return;
        const teamArr = team === 'A' ? court.teamA : court.teamB;
        if (teamArr.length >= 2) {
          deselectAll();
          return;
        }

        if (person.status === 'available') {
          pool = pool.filter(function (p) {
            return p.id !== selectedId;
          });
        } else {
          const oc = courts[person.groupNo];
          if (oc) {
            if (person.status === 'team-a')
              oc.teamA = oc.teamA.filter(function (p) {
                return p.id !== person.id;
              });
            else
              oc.teamB = oc.teamB.filter(function (p) {
                return p.id !== person.id;
              });
          }
        }
        person.status = team === 'A' ? 'team-a' : 'team-b';
        person.groupNo = courtIdx;
        teamArr.push(person);
        deselectAll();
        render();
        syncState();
      }

      function onClickMember(targetPersonId) {
        if (selectedId === null || selectedId === targetPersonId) return;
        const tempId = selectedId;
        deselectAll();
        draggedId = tempId;
        const chip = document.querySelector('.member-chip[data-id="' + targetPersonId + '"]');
        onDropMember(
          { preventDefault: function () {}, currentTarget: chip || { classList: { remove: function () {} } } },
          targetPersonId,
        );
      }

      /* 성별·급수 입력 상태 */
      let selectedGender = '남';
      let selectedLevel = 'A';

      const GENDER_ORDER = { 남: 0, 여: 1 };
      const LEVEL_ORDER = { A: 0, B: 1, C: 2, D: 3, E: 4 };

      function setGender(g) {
        selectedGender = g;
        document.getElementById('btn-male').classList.toggle('active', g === '남');
        document.getElementById('btn-female').classList.toggle('active', g === '여');
      }

      function setLevel(l) {
        selectedLevel = l;
        ['A', 'B', 'C', 'D', 'E'].forEach((x) =>
          document.getElementById(`btn-lv-${x}`).classList.toggle('active', x === l),
        );
      }

      /* 성별→급수 순 정렬 */
      function sortedPeople(arr) {
        return [...arr].sort((a, b) => {
          const gd = (GENDER_ORDER[a.gender] ?? 0) - (GENDER_ORDER[b.gender] ?? 0);
          if (gd !== 0) return gd;
          return (LEVEL_ORDER[a.level] ?? 0) - (LEVEL_ORDER[b.level] ?? 0);
        });
      }

      /* 배지 안 성별·급수 표기 */
      function infoTag(p) {
        const gc = p.gender === '남' ? 'gm' : 'gf';
        const lc = `lv-${p.level || '?'}`;
        return `<span class="info-sub"><span class="${gc}">${p.gender || ''}</span> · <span class="${lc}">${p.level || ''}급</span></span>`;
      }

      /* ────── 코트 수 변경 ────── */
      function onCourtChange() {
        const v = parseInt(document.getElementById('court-input').value) || 0;
        const newCount = Math.max(0, v);

        if (newCount > courts.length) {
          for (let i = courts.length; i < newCount; i++) {
            courts.push({ teamA: [], teamB: [] });
          }
        } else if (newCount < courts.length) {
          const removed = courts.splice(newCount);
          removed.forEach((c) => {
            [...c.teamA, ...c.teamB].forEach((p) => {
              p.status = 'available';
              p.groupNo = null;
              pool.push(p);
            });
          });
        }

        courtCount = newCount;
        localStorage.setItem('courtCount', courtCount);
        render();
        syncState();
      }

      /* ────── 한글 IME 버그 방지 ────── */
      document.getElementById('name-input').addEventListener('keyup', function (e) {
        if (e.key === 'Enter' && !e.isComposing) addPerson();
      });

      /* ────── 인원 추가 ────── */
      function addPerson() {
        const input = document.getElementById('name-input');
        const name = input.value.trim();
        if (!name) return;
        const p = {
          id: nextId++,
          name,
          gender: selectedGender,
          level: selectedLevel,
          status: 'available',
          groupNo: null,
        };
        people.push(p);
        pool.push(p);
        input.value = '';
        input.focus();
        render();
        syncState();
      }

      /* ────── 대기 인원 삭제 ────── */
      function removePerson(id) {
        const p = people.find((x) => x.id === id);
        if (!p || p.status !== 'available') return;
        people = people.filter((x) => x.id !== id);
        pool = pool.filter((x) => x.id !== id);
        render();
        syncState();
      }

      /* ────── 개인 대기 복귀 ────── */
      function returnFromCourt(personId) {
        const p = people.find((x) => x.id === personId);
        if (!p || p.groupNo === null) return;
        const court = courts[p.groupNo];
        if (court) {
          court.teamA = court.teamA.filter((x) => x.id !== personId);
          court.teamB = court.teamB.filter((x) => x.id !== personId);
        }
        p.status = 'available';
        p.groupNo = null;
        pool.push(p);
        render();
        syncState();
      }

      /* ────── 코트 전체 대기 복귀 (제목 더블클릭) ────── */
      function returnAllFromCourt(courtIdx) {
        const court = courts[courtIdx];
        if (!court) return;
        [...court.teamA, ...court.teamB].forEach((p) => {
          p.status = 'available';
          p.groupNo = null;
          pool.push(p);
        });
        court.teamA = [];
        court.teamB = [];
        render();
        syncState();
      }

      /* ────── 랜덤 배정 ────── */
      function assignCourts() {
        if (pool.length === 0) return;
        const shuffled = shuffle(pool);
        let idx = 0;
        for (const [ci, court] of courts.entries()) {
          while (court.teamA.length < 2 && idx < shuffled.length) {
            const p = shuffled[idx++];
            p.status = 'team-a';
            p.groupNo = ci;
            court.teamA.push(p);
          }
          while (court.teamB.length < 2 && idx < shuffled.length) {
            const p = shuffled[idx++];
            p.status = 'team-b';
            p.groupNo = ci;
            court.teamB.push(p);
          }
        }
        const assignedIds = new Set(shuffled.slice(0, idx).map((p) => p.id));
        pool = pool.filter((p) => !assignedIds.has(p.id));
        render();
        syncState();
      }

      /* ────── 드래그 앤 드롭 ────────────────────────────────────────
       핵심 규칙:
       - onDragStart / onDragEnd 에서 render() 호출 금지
         (DOM 재생성 시 브라우저 드래그 세션이 끊김)
       - 시각 피드백은 classList 직접 조작 + CSS body.is-dragging 활용
    ──────────────────────────────────────────────────────────────── */
      function onDragStart(e, personId) {
        deselectAll();
        draggedId = personId;
        e.dataTransfer.effectAllowed = 'move';
        // 드래그 이미지 생성 후 원본에 흐림 효과 (한 프레임 뒤에 적용해야 드래그 이미지에 영향 없음)
        requestAnimationFrame(() => {
          const el = document.querySelector(`.p-badge[data-id="${personId}"], .member-chip[data-id="${personId}"]`);
          if (el) el.classList.add('dragging');
        });
        document.body.classList.add('is-dragging');
      }

      function onDragEnd() {
        draggedId = null;
        document.body.classList.remove('is-dragging');
        document
          .querySelectorAll('.p-badge.dragging, .member-chip.dragging')
          .forEach((el) => el.classList.remove('dragging'));
        document
          .querySelectorAll('.drop-slot.drag-over, .member-chip.drag-over')
          .forEach((el) => el.classList.remove('drag-over'));
      }

      function onDragOverSlot(e, courtIdx, team) {
        if (draggedId === null) return;
        const court = courts[courtIdx];
        if (!court) return;
        const teamArr = team === 'A' ? court.teamA : court.teamB;
        if (teamArr.length < 2) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }
      }

      function onSlotEnter(e) {
        if (draggedId === null) return;
        e.currentTarget.classList.add('drag-over');
      }

      function onSlotLeave(e) {
        // relatedTarget 이 슬롯 내부 자식이 아닐 때만 제거 (텍스트 노드 대비)
        if (!e.currentTarget.contains(e.relatedTarget)) {
          e.currentTarget.classList.remove('drag-over');
        }
      }

      function onDropSlot(e, courtIdx, team) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        if (draggedId === null) return;

        const person = people.find((p) => p.id === draggedId);
        if (!person) {
          onDragEnd();
          return;
        }

        const court = courts[courtIdx];
        if (!court) {
          onDragEnd();
          return;
        }

        const teamArr = team === 'A' ? court.teamA : court.teamB;
        if (teamArr.length >= 2) {
          onDragEnd();
          return;
        }

        if (person.status === 'available') {
          pool = pool.filter((p) => p.id !== draggedId);
        } else {
          const oldCourt = courts[person.groupNo];
          if (oldCourt) {
            if (person.status === 'team-a') oldCourt.teamA = oldCourt.teamA.filter((p) => p.id !== person.id);
            else oldCourt.teamB = oldCourt.teamB.filter((p) => p.id !== person.id);
          }
        }
        person.status = team === 'A' ? 'team-a' : 'team-b';
        person.groupNo = courtIdx;
        teamArr.push(person);

        onDragEnd();
        render();
        syncState();
      }

      /* ────── 특정 코트 개별 배정 ────── */
      function assignSingleCourt(courtIdx) {
        const court = courts[courtIdx];
        if (!court || pool.length === 0) return;

        const emptyA = 2 - court.teamA.length;
        const emptyB = 2 - court.teamB.length;
        const totalEmpty = emptyA + emptyB;
        if (totalEmpty === 0) return;

        const shuffled = shuffle(pool);
        const toAssign = shuffled.slice(0, totalEmpty);
        let idx = 0;

        while (court.teamA.length < 2 && idx < toAssign.length) {
          const p = toAssign[idx++];
          p.status = 'team-a';
          p.groupNo = courtIdx;
          court.teamA.push(p);
        }
        while (court.teamB.length < 2 && idx < toAssign.length) {
          const p = toAssign[idx++];
          p.status = 'team-b';
          p.groupNo = courtIdx;
          court.teamB.push(p);
        }

        const assignedIds = new Set(toAssign.slice(0, idx).map((p) => p.id));
        pool = pool.filter((p) => !assignedIds.has(p.id));
        render();
        syncState();
      }

      /* ────── 특정 코트 성별 배정 ────── */
      function assignSingleCourtByGender(courtIdx, gender) {
        const court = courts[courtIdx];
        if (!court) return;

        const genderPool = pool.filter((p) => p.gender === gender);
        if (genderPool.length === 0) return;

        const emptyA = 2 - court.teamA.length;
        const emptyB = 2 - court.teamB.length;
        const totalEmpty = emptyA + emptyB;
        if (totalEmpty === 0) return;

        const shuffled = shuffle(genderPool);
        const toAssign = shuffled.slice(0, totalEmpty);
        let idx = 0;

        while (court.teamA.length < 2 && idx < toAssign.length) {
          const p = toAssign[idx++];
          p.status = 'team-a';
          p.groupNo = courtIdx;
          court.teamA.push(p);
        }
        while (court.teamB.length < 2 && idx < toAssign.length) {
          const p = toAssign[idx++];
          p.status = 'team-b';
          p.groupNo = courtIdx;
          court.teamB.push(p);
        }

        const assignedIds = new Set(toAssign.slice(0, idx).map((p) => p.id));
        pool = pool.filter((p) => !assignedIds.has(p.id));
        render();
        syncState();
      }

      /* ────── 특정 코트 혼복 배정 (각 팀 남1+여1) ────── */
      function assignSingleCourtMixed(courtIdx) {
        const court = courts[courtIdx];
        if (!court) return;

        const males = shuffle(pool.filter((p) => p.gender === '남'));
        const females = shuffle(pool.filter((p) => p.gender === '여'));
        if (males.length === 0 || females.length === 0) return;

        const toAssign = [];
        let mi = 0,
          fi = 0;

        const fillTeam = (emptyCount, team) => {
          let needMale = true;
          for (let i = 0; i < emptyCount; i++) {
            if (needMale && mi < males.length) {
              toAssign.push({ person: males[mi++], team });
            } else if (!needMale && fi < females.length) {
              toAssign.push({ person: females[fi++], team });
            } else if (mi < males.length) {
              toAssign.push({ person: males[mi++], team });
            } else if (fi < females.length) {
              toAssign.push({ person: females[fi++], team });
            }
            needMale = !needMale;
          }
        };

        fillTeam(2 - court.teamA.length, 'A');
        fillTeam(2 - court.teamB.length, 'B');

        for (const { person, team } of toAssign) {
          person.status = team === 'A' ? 'team-a' : 'team-b';
          person.groupNo = courtIdx;
          if (team === 'A') court.teamA.push(person);
          else court.teamB.push(person);
        }

        const assignedIds = new Set(toAssign.map(({ person }) => person.id));
        pool = pool.filter((p) => !assignedIds.has(p.id));
        render();
        syncState();
      }

      /* ────── 코트 멤버 간 드래그 앤 드롭 (스왑) ────── */
      function onDragOverMember(e, targetPersonId) {
        if (draggedId === null || draggedId === targetPersonId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }

      function onDropMember(e, targetPersonId) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        if (draggedId === null || draggedId === targetPersonId) return;

        const dragged = people.find((p) => p.id === draggedId);
        const target = people.find((p) => p.id === targetPersonId);
        if (!dragged || !target) {
          onDragEnd();
          return;
        }

        // target의 현재 위치 저장
        const targetStatus = target.status;
        const targetGroupNo = target.groupNo;
        const targetCourt = courts[target.groupNo];

        // target을 현재 코트에서 제거
        if (targetCourt) {
          if (target.status === 'team-a') targetCourt.teamA = targetCourt.teamA.filter((p) => p.id !== target.id);
          else targetCourt.teamB = targetCourt.teamB.filter((p) => p.id !== target.id);
        }

        if (dragged.status === 'available') {
          // 대기 인원 ↔ 코트 멤버 스왑
          pool = pool.filter((p) => p.id !== dragged.id);
          dragged.status = targetStatus;
          dragged.groupNo = targetGroupNo;
          if (targetStatus === 'team-a') courts[targetGroupNo].teamA.push(dragged);
          else courts[targetGroupNo].teamB.push(dragged);

          target.status = 'available';
          target.groupNo = null;
          pool.push(target);
        } else {
          // 코트 멤버 ↔ 코트 멤버 스왑
          const draggedStatus = dragged.status;
          const draggedGroupNo = dragged.groupNo;
          const draggedCourt = courts[dragged.groupNo];

          if (draggedCourt) {
            if (dragged.status === 'team-a') draggedCourt.teamA = draggedCourt.teamA.filter((p) => p.id !== dragged.id);
            else draggedCourt.teamB = draggedCourt.teamB.filter((p) => p.id !== dragged.id);
          }

          dragged.status = targetStatus;
          dragged.groupNo = targetGroupNo;
          if (targetStatus === 'team-a') courts[targetGroupNo].teamA.push(dragged);
          else courts[targetGroupNo].teamB.push(dragged);

          target.status = draggedStatus;
          target.groupNo = draggedGroupNo;
          if (draggedStatus === 'team-a') courts[draggedGroupNo].teamA.push(target);
          else courts[draggedGroupNo].teamB.push(target);
        }

        onDragEnd();
        render();
        syncState();
      }

      /* ────── 초기화 모달 ────── */
      function resetAll() {
        document.getElementById('modal-overlay').classList.add('show');
      }

      function closeModal() {
        document.getElementById('modal-overlay').classList.remove('show');
      }

      function confirmReset() {
        people = [];
        pool = [];
        courts = [];
        courtCount = 0;
        nextId = 1;
        draggedId = null;
        document.getElementById('court-input').value = '';
        document.body.classList.remove('is-dragging');
        localStorage.removeItem('courtCount');
        closeModal();
        render();
        syncState();
      }

      /* ────── 샘플 데이터 생성 ────── */
      function generateSampleData() {
        const maleNames = [
          '김민준',
          '이준호',
          '박지호',
          '최현우',
          '정우진',
          '강민재',
          '조성훈',
          '윤지훈',
          '장태양',
          '한동현',
          '임도현',
          '오승민',
          '서준혁',
          '신재원',
          '문현기',
        ];
        const femaleNames = [
          '김지아',
          '이수연',
          '박민지',
          '최예진',
          '정하은',
          '강지우',
          '조아라',
          '윤서연',
          '장나은',
          '한채원',
          '임유진',
          '오소연',
          '서지현',
          '신다은',
          '문하늘',
        ];
        const levels = ['A', 'B', 'C', 'D', 'E'];
        let mi = 0,
          fi = 0;

        levels.forEach((level) => {
          for (let i = 0; i < 3; i++) {
            const p = { id: nextId++, name: maleNames[mi++], gender: '남', level, status: 'available', groupNo: null };
            people.push(p);
            pool.push(p);
          }
          for (let i = 0; i < 3; i++) {
            const p = {
              id: nextId++,
              name: femaleNames[fi++],
              gender: '여',
              level,
              status: 'available',
              groupNo: null,
            };
            people.push(p);
            pool.push(p);
          }
        });

        // 코트 2개 설정
        while (courts.length < 2) courts.push({ teamA: [], teamB: [] });
        courtCount = 2;
        document.getElementById('court-input').value = '2';
        render();
        syncState();
      }

      /* ────── DB: 회원 가져오기 (버튼 클릭 → 기존 인원에 추가) ────── */
      async function fetchMembers() {
        const btn = document.getElementById('btn-fetch');
        const panel = document.getElementById('fetch-result-panel');
        const meta = document.getElementById('fetch-result-meta');
        const body = document.getElementById('fetch-result-body');
        const original = btn.textContent;

        btn.disabled = true;
        btn.textContent = '불러오는 중...';
        panel.style.display = 'none';

        const { data, error } = await db.from('members').select('id, name, gender, level').eq('is_active', true);

        btn.disabled = false;
        btn.textContent = original;

        // ── 결과 패널 표시 ──
        panel.style.display = 'block';

        if (error) {
          console.error('회원 조회 실패:', error);
          meta.textContent = '조회 실패';
          body.innerHTML = `<div class="fetch-result-error">
            <strong>오류 코드:</strong> ${error.code || '-'}<br>
            <strong>메시지:</strong> ${error.message}<br>
            <strong>상세:</strong> ${error.details || '-'}
          </div>`;
          return;
        }

        // 이미 추가된 dbId 집합 (중복 방지)
        const existingDbIds = new Set(people.filter((p) => p.dbId).map((p) => p.dbId));

        let added = 0;
        data.forEach((member) => {
          if (existingDbIds.has(member.id)) return;
          const p = {
            id: nextId++,
            dbId: member.id,
            name: member.name,
            gender: member.gender,
            level: member.level,
            status: 'available',
            groupNo: null,
          };
          people.push(p);
          pool.push(p);
          added++;
        });

        render();
        if (added > 0) syncState();

        // ── 조회 결과 목록 렌더 ──
        meta.textContent = `총 ${data.length}건 조회 · ${added}명 신규 추가`;

        if (data.length === 0) {
          body.innerHTML =
            '<div class="fetch-result-error" style="color:#888;background:#f9f9f9">조회된 회원이 없습니다. (is_active = true 인 데이터 확인)</div>';
        } else {
          body.innerHTML =
            '<div class="fetch-result-grid">' +
            data
              .map((m) => {
                const gc = m.gender === '남' ? 'm' : 'f';
                const isNew = !existingDbIds.has(m.id);
                return `<div class="fetch-result-item gender-${gc}" title="${isNew ? '신규 추가' : '이미 존재'}${isNew ? '' : ' (중복)'}">
                ${m.name}
                <span class="r-sub">${m.gender} · ${m.level}급${isNew ? '' : ' ✓'}</span>
              </div>`;
              })
              .join('') +
            '</div>';
        }

        if (added > 0) {
          btn.textContent = `✔ ${added}명 추가됨`;
          setTimeout(() => {
            btn.textContent = original;
          }, 2000);
        }
      }

      /* ────── DB: 상태 동기화 & 복원 ────── */
      let dbSyncEnabled = false;

      async function syncState() {
        if (!dbSyncEnabled) return;
        try {
          await Promise.all([
            db.from('waiting_queue').delete().not('id', 'is', null),
            db.from('court_assignments').delete().not('id', 'is', null),
          ]);

          const waitingRows = pool.map((p) => ({
            member_id: p.dbId || null,
            name: p.name,
            gender: p.gender,
            level: p.level,
          }));

          const assignedRows = [];
          courts.forEach((court, ci) => {
            court.teamA.forEach((p) =>
              assignedRows.push({ court_no: ci, team: 'A', member_id: p.dbId || null, name: p.name, gender: p.gender, level: p.level }),
            );
            court.teamB.forEach((p) =>
              assignedRows.push({ court_no: ci, team: 'B', member_id: p.dbId || null, name: p.name, gender: p.gender, level: p.level }),
            );
          });

          const ops = [];
          if (waitingRows.length > 0) ops.push(db.from('waiting_queue').insert(waitingRows));
          if (assignedRows.length > 0) ops.push(db.from('court_assignments').insert(assignedRows));
          if (ops.length > 0) await Promise.all(ops);

          localStorage.setItem('courtCount', courtCount);
        } catch (err) {
          console.error('DB 동기화 오류:', err);
        }
      }

      /* ────── DB: 페이지 로드 시 상태 복원 ────── */
      async function loadState() {
        const [wqCheck, caCheck] = await Promise.all([
          db.from('waiting_queue').select('id').limit(1),
          db.from('court_assignments').select('id').limit(1),
        ]);

        if (wqCheck.error || caCheck.error) {
          const sql =
            'CREATE TABLE IF NOT EXISTS waiting_queue (\n' +
            '  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,\n' +
            '  member_id uuid,\n' +
            '  name text NOT NULL,\n' +
            '  gender text,\n' +
            '  level text,\n' +
            '  created_at timestamptz DEFAULT now()\n' +
            ');\n' +
            'ALTER TABLE waiting_queue ENABLE ROW LEVEL SECURITY;\n' +
            'CREATE POLICY "anon all" ON waiting_queue FOR ALL TO anon USING (true) WITH CHECK (true);\n\n' +
            'CREATE TABLE IF NOT EXISTS court_assignments (\n' +
            '  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,\n' +
            '  court_no integer NOT NULL,\n' +
            '  team text NOT NULL,\n' +
            '  member_id uuid,\n' +
            '  name text NOT NULL,\n' +
            '  gender text,\n' +
            '  level text,\n' +
            '  assigned_at timestamptz DEFAULT now()\n' +
            ');\n' +
            'ALTER TABLE court_assignments ENABLE ROW LEVEL SECURITY;\n' +
            'CREATE POLICY "anon all" ON court_assignments FOR ALL TO anon USING (true) WITH CHECK (true);';
          console.warn(
            '⚠ 대기인원/코트배정 테이블 접근 실패 → 메모리 모드로 동작합니다.\n' +
            'Supabase 대시보드 SQL 편집기에서 아래 SQL을 실행해 주세요:\n\n' + sql,
          );
          dbSyncEnabled = false;
          render();
          return;
        }

        dbSyncEnabled = true;

        const [{ data: wqData }, { data: caData }] = await Promise.all([
          db.from('waiting_queue').select('*').order('created_at'),
          db.from('court_assignments').select('*').order('court_no').order('team').order('assigned_at'),
        ]);

        people = [];
        pool = [];
        courts = [];
        nextId = 1;

        (wqData || []).forEach((row) => {
          const p = {
            id: nextId++,
            dbId: row.member_id || null,
            name: row.name,
            gender: row.gender || '남',
            level: row.level || 'A',
            status: 'available',
            groupNo: null,
          };
          people.push(p);
          pool.push(p);
        });

        const maxCourt = (caData || []).reduce((m, r) => Math.max(m, r.court_no), -1);
        const savedCount = parseInt(localStorage.getItem('courtCount')) || 0;
        courtCount = Math.max(maxCourt + 1, savedCount);
        while (courts.length < courtCount) courts.push({ teamA: [], teamB: [] });
        if (courtCount > 0) document.getElementById('court-input').value = courtCount;

        (caData || []).forEach((row) => {
          const p = {
            id: nextId++,
            dbId: row.member_id || null,
            name: row.name,
            gender: row.gender || '남',
            level: row.level || 'A',
            status: row.team === 'A' ? 'team-a' : 'team-b',
            groupNo: row.court_no,
          };
          people.push(p);
          const court = courts[row.court_no];
          if (court) (row.team === 'A' ? court.teamA : court.teamB).push(p);
        });

        render();
      }

      /* ────── 유틸 ────── */
      function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }

      /* ────── 렌더 ────── */
      function render() {
        const fullCourts = courts.filter((c) => c.teamA.length === 2 && c.teamB.length === 2).length;
        const hasEmptySlot = courts.some((c) => c.teamA.length + c.teamB.length < 4);
        const canAssign = courtCount > 0 && pool.length > 0 && hasEmptySlot;

        // Stats
        document.getElementById('st-total').textContent = people.length;
        document.getElementById('st-courts').textContent = courtCount > 0 ? `${fullCourts} / ${courtCount}` : '0';
        document.getElementById('st-pool').textContent = pool.length;

        // 코트 배지
        const badge = document.getElementById('court-badge');
        if (courtCount > 0) {
          badge.style.display = 'inline-flex';
          badge.textContent = `코트 ${courtCount}개 · 최대 ${courtCount * 4}명`;
        } else {
          badge.style.display = 'none';
        }

        // 버튼
        const btn = document.getElementById('btn-assign');
        btn.disabled = !canAssign;
        if (courtCount === 0) {
          btn.textContent = '코트 수를 먼저 입력해 주세요';
        } else if (pool.length === 0) {
          btn.textContent = '대기 인원 없음';
        } else if (!hasEmptySlot) {
          btn.textContent = '모든 코트 배정 완료';
        } else {
          const emptySlots = courts.reduce((s, c) => s + (4 - c.teamA.length - c.teamB.length), 0);
          const fills = Math.min(pool.length, emptySlots);
          btn.textContent = `랜덤 배정 (${fills}명 배정 가능)`;
        }

        // ── 대기 인원 그리드 (성별→급수 정렬) ──
        const poolPeople = sortedPeople(people.filter((p) => p.status === 'available'));
        const assignedPeople = sortedPeople(people.filter((p) => p.status === 'team-a' || p.status === 'team-b'));

        document.getElementById('count-pool').textContent = `${poolPeople.length}명`;
        document.getElementById('count-assigned').textContent = `${assignedPeople.length}명`;

        const poolGrid = document.getElementById('pool-grid');
        if (poolPeople.length === 0) {
          poolGrid.innerHTML = `<div class="empty-msg">${
            people.length === 0 ? '이름을 입력해서 인원을 추가하세요.' : '대기 중인 인원이 없습니다.'
          }</div>`;
        } else {
          poolGrid.innerHTML = poolPeople
            .map((p) => {
              const gc = p.gender === '남' ? 'm' : 'f';
              return `<div
                    class="p-badge available gender-${gc}"
                    data-id="${p.id}"
                    draggable="true"
                    ondragstart="onDragStart(event,${p.id})"
                    ondragend="onDragEnd()"
                    onclick="onClickPoolBadge(${p.id})"
                    ondblclick="removePerson(${p.id})"
                    title="클릭: 선택 후 빈 자리 클릭으로 배정  |  드래그: 배정  |  더블클릭: 삭제"
                >${p.name}${infoTag(p)}</div>`;
            })
            .join('');
        }

        // ── 코트 배정 인원 그리드 (성별→급수 정렬) ──
        const assignedGrid = document.getElementById('assigned-grid');
        if (assignedPeople.length === 0) {
          assignedGrid.innerHTML = '<div class="empty-msg">아직 배정된 인원이 없습니다.</div>';
        } else {
          assignedGrid.innerHTML = assignedPeople
            .map((p) => {
              const gc = p.gender === '남' ? 'm' : 'f';
              const t = p.status === 'team-a' ? 'A팀' : 'B팀';
              const ctSub = `<span class="sub">${p.groupNo + 1}번 코트 ${t}</span>`;
              return `<div
                    class="p-badge ${p.status} gender-${gc}"
                    data-id="${p.id}"
                    ondblclick="returnFromCourt(${p.id})"
                    title="더블클릭: 대기로 복귀"
                >${p.name}${infoTag(p)}${ctSub}</div>`;
            })
            .join('');
        }

        // 코트 현황
        const secC = document.getElementById('sec-courts');
        if (courtCount > 0) {
          secC.style.display = 'block';
          const maleInPool = pool.filter((p) => p.gender === '남').length;
          const femaleInPool = pool.filter((p) => p.gender === '여').length;
          document.getElementById('courts-grid').innerHTML = courts
            .map((court, ci) => {
              const renderSlots = (teamArr, team) => {
                let html = '';
                for (const p of teamArr) {
                  const gc = p.gender === '남' ? 'm' : 'f';
                  html += `<div class="member-chip gender-${gc}"
                            data-id="${p.id}"
                            draggable="true"
                            ondragstart="onDragStart(event,${p.id})"
                            ondragend="onDragEnd()"
                            ondragover="onDragOverMember(event,${p.id})"
                            ondrop="onDropMember(event,${p.id})"
                            ondragenter="onSlotEnter(event)"
                            ondragleave="onSlotLeave(event)"
                            onclick="onClickMember(${p.id})"
                            ondblclick="returnFromCourt(${p.id})"
                            title="클릭(선택 중): 스왑  |  드래그: 위치 변경  |  더블클릭: 대기로 복귀">${p.name}${infoTag(p)}</div><br>`;
                }
                const emptyCount = 2 - teamArr.length;
                for (let i = 0; i < emptyCount; i++) {
                  html += `<div
                            class="drop-slot"
                            data-slot-court="${ci}"
                            data-slot-team="${team}"
                            ondragover="onDragOverSlot(event,${ci},'${team}')"
                            ondrop="onDropSlot(event,${ci},'${team}')"
                            ondragenter="onSlotEnter(event)"
                            ondragleave="onSlotLeave(event)"
                            onclick="onClickSlot(${ci},'${team}')"
                        >빈 자리</div><br>`;
                }
                return html;
              };

              const total = court.teamA.length + court.teamB.length;
              const isFull = total === 4;

              return `
                    <div class="court-card${isFull ? ' full' : ''}">
                        <div class="court-hdr"
                            data-court-idx="${ci}"
                            ondblclick="returnAllFromCourt(${ci})"
                            title="더블클릭: 전원 대기로 복귀">
                            <span>${ci + 1}번 </span>
                            <div class="court-hdr-right">
                                <button class="btn-court-assign"
                                    onclick="event.stopPropagation(); assignSingleCourt(${ci})"
                                    ondblclick="event.stopPropagation()"
                                    ${isFull || pool.length === 0 ? 'disabled' : ''}
                                >랜덤</button>
                                <button class="btn-court-assign male"
                                    onclick="event.stopPropagation(); assignSingleCourtByGender(${ci},'남')"
                                    ondblclick="event.stopPropagation()"
                                    ${isFull || maleInPool === 0 ? 'disabled' : ''}
                                >남복</button>
                                <button class="btn-court-assign female"
                                    onclick="event.stopPropagation(); assignSingleCourtByGender(${ci},'여')"
                                    ondblclick="event.stopPropagation()"
                                    ${isFull || femaleInPool === 0 ? 'disabled' : ''}
                                >여복</button>
                                <button class="btn-court-assign mixed"
                                    onclick="event.stopPropagation(); assignSingleCourtMixed(${ci})"
                                    ondblclick="event.stopPropagation()"
                                    ${isFull || maleInPool === 0 || femaleInPool === 0 ? 'disabled' : ''}
                                >혼복</button>
                                <span class="chint">
                                    ${isFull ? '✔ 완료' : `${total}/4명`}
                                    &nbsp;|&nbsp; 더블클릭 → 전원 복귀
                                </span>
                            </div>
                        </div>
                        <div class="court-body">
                            <div class="team-box ta">
                                <div class="team-lbl">A팀</div>
                                ${renderSlots(court.teamA, 'A')}
                            </div>
                            <div class="vs-col">VS</div>
                            <div class="team-box tb">
                                <div class="team-lbl">B팀</div>
                                ${renderSlots(court.teamB, 'B')}
                            </div>
                        </div>
                    </div>`;
            })
            .join('');
        } else {
          secC.style.display = 'none';
        }

        // 클릭 선택 상태 복원 (render 후 DOM 재생성으로 사라진 .selected 재적용)
        if (selectedId !== null) {
          const selP = people.find(function (x) {
            return x.id === selectedId;
          });
          if (!selP || selP.status !== 'available') {
            deselectAll();
          } else {
            document.body.classList.add('has-selection');
            const selEl = document.querySelector('.p-badge.available[data-id="' + selectedId + '"]');
            if (selEl) selEl.classList.add('selected');
          }
        }
      }

      loadState();

      /* ══════════════════════════════════════════════════════════════
         터치 드래그 앤 드롭 시스템 (모바일)

         동작 방식:
           - 300 ms 누름 유지 → 드래그 활성 (진동 피드백)
           - 활성 후 움직임 → 고스트 생성, 드롭 대상 강조
           - 손 뗌 → 드롭 실행
           - 700 ms 누름 유지 → 삭제 / 대기 복귀 (더블클릭 대체)
           - 8 px 이상 이동 후 300 ms 미도달 → 스크롤로 간주, 취소
         ═══════════════════════════════════════════════════════════════ */

      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isTouchDevice) document.body.classList.add('touch-device');

      const ts = {
        personId: null,
        el: null,
        ghost: null,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        ready: false, // 300 ms 경과 → 드래그 준비 완료
        dragging: false, // 실제 이동 중
        readyTimer: null,
        actionTimer: null,
        longAction: null,
      };

      function tsCleanup() {
        clearTimeout(ts.readyTimer);
        clearTimeout(ts.actionTimer);
        ts.readyTimer = null;
        ts.actionTimer = null;
        if (ts.ghost) {
          ts.ghost.remove();
          ts.ghost = null;
        }
        if (ts.el) {
          ts.el.classList.remove('dragging', 'touch-drag-ready');
        }
        document.body.classList.remove('is-dragging');
        document
          .querySelectorAll('.p-badge.dragging, .member-chip.dragging')
          .forEach((el) => el.classList.remove('dragging'));
        document
          .querySelectorAll('.drop-slot.drag-over, .member-chip.drag-over')
          .forEach((el) => el.classList.remove('drag-over'));
        draggedId = null;
        ts.personId = null;
        ts.el = null;
        ts.ready = false;
        ts.dragging = false;
        ts.longAction = null;
      }

      document.addEventListener(
        'touchstart',
        function (e) {
          const draggable = e.target.closest('.p-badge.available, .member-chip');
          const assigned = !draggable && e.target.closest('.p-badge.team-a, .p-badge.team-b');
          const hdr = !draggable && !assigned && e.target.closest('.court-hdr[data-court-idx]');
          if (!draggable && !assigned && !hdr) return;

          const t = e.touches[0];
          ts.startX = ts.lastX = t.clientX;
          ts.startY = ts.lastY = t.clientY;
          ts.ready = ts.dragging = false;

          if (draggable || assigned) {
            ts.el = draggable || assigned;
            ts.personId = parseInt(ts.el.dataset.id);

            ts.longAction =
              draggable && draggable.classList.contains('available')
                ? () => removePerson(ts.personId)
                : () => returnFromCourt(ts.personId);

            // 300 ms → 드래그 준비 (draggable 요소만)
            if (draggable) {
              ts.readyTimer = setTimeout(function () {
                if (!ts.dragging) {
                  ts.ready = true;
                  ts.el.classList.add('touch-drag-ready');
                  if (navigator.vibrate) navigator.vibrate(30);
                }
              }, 300);
            }

            // 700 ms → 삭제 / 대기 복귀
            ts.actionTimer = setTimeout(function () {
              if (!ts.dragging && ts.longAction) {
                if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
                var fn = ts.longAction;
                tsCleanup();
                fn();
              }
            }, 700);
          } else if (hdr) {
            ts.el = hdr;
            var ci = parseInt(hdr.dataset.courtIdx);
            ts.actionTimer = setTimeout(function () {
              if (!ts.dragging) {
                if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
                tsCleanup();
                returnAllFromCourt(ci);
              }
            }, 700);
          }
        },
        { passive: true },
      );

      document.addEventListener(
        'touchmove',
        function (e) {
          if (!ts.el) return;
          var t = e.touches[0];
          var dx = t.clientX - ts.startX;
          var dy = t.clientY - ts.startY;
          var dist = Math.sqrt(dx * dx + dy * dy);
          ts.lastX = t.clientX;
          ts.lastY = t.clientY;

          if (!ts.ready && !ts.dragging) {
            if (dist > 8) {
              // 준비 전 8 px 초과 이동 → 스크롤로 간주, 취소
              tsCleanup();
            }
            return;
          }

          // 드래그 준비 완료 상태에서 실제 이동 시작
          if (ts.ready && !ts.dragging && dist > 4 && ts.personId !== null) {
            clearTimeout(ts.actionTimer);
            ts.actionTimer = null;
            ts.dragging = true;
            draggedId = ts.personId;
            ts.el.classList.remove('touch-drag-ready');
            ts.el.classList.add('dragging');
            document.body.classList.add('is-dragging');

            var rect = ts.el.getBoundingClientRect();
            ts.ghost = ts.el.cloneNode(true);
            ts.ghost.style.cssText = [
              'position:fixed',
              'left:' + rect.left + 'px',
              'top:' + rect.top + 'px',
              'width:' + rect.width + 'px',
              'margin:0',
              'opacity:.75',
              'pointer-events:none',
              'z-index:9999',
              'transform:scale(1.1)',
              'box-shadow:0 8px 24px rgba(0,0,0,.25)',
              'transition:none',
            ].join(';');
            document.body.appendChild(ts.ghost);
          }

          if (ts.dragging && ts.ghost) {
            e.preventDefault();
            var rect = ts.el.getBoundingClientRect();
            ts.ghost.style.left = rect.left + dx + 'px';
            ts.ghost.style.top = rect.top + dy + 'px';

            // 드롭 대상 강조
            ts.ghost.style.display = 'none';
            var under = document.elementFromPoint(t.clientX, t.clientY);
            ts.ghost.style.display = '';

            document.querySelectorAll('.drop-slot.drag-over, .member-chip.drag-over').forEach(function (el) {
              el.classList.remove('drag-over');
            });

            if (under) {
              var slot = under.closest('.drop-slot[data-slot-court]');
              var chip = under.closest('.member-chip[data-id]');
              if (slot) slot.classList.add('drag-over');
              else if (chip && parseInt(chip.dataset.id) !== ts.personId) chip.classList.add('drag-over');
            }
          }
        },
        { passive: false },
      );

      document.addEventListener(
        'touchend',
        function (e) {
          clearTimeout(ts.readyTimer);
          clearTimeout(ts.actionTimer);

          if (ts.dragging) {
            e.preventDefault();

            if (ts.ghost) ts.ghost.style.display = 'none';
            var under = document.elementFromPoint(ts.lastX, ts.lastY);
            if (ts.ghost) ts.ghost.style.display = '';

            document.querySelectorAll('.drop-slot.drag-over, .member-chip.drag-over').forEach(function (el) {
              el.classList.remove('drag-over');
            });

            var acted = false;
            if (under) {
              var slot = under.closest('.drop-slot[data-slot-court]');
              var chip = under.closest('.member-chip[data-id]');
              if (slot) {
                onDropSlot(
                  { preventDefault: function () {}, currentTarget: slot },
                  parseInt(slot.dataset.slotCourt),
                  slot.dataset.slotTeam,
                );
                acted = true;
              } else if (chip && parseInt(chip.dataset.id) !== ts.personId) {
                onDropMember({ preventDefault: function () {}, currentTarget: chip }, parseInt(chip.dataset.id));
                acted = true;
              }
            }
            if (!acted) onDragEnd();
          }

          tsCleanup();
        },
        { passive: false },
      );

      document.addEventListener(
        'touchcancel',
        function () {
          onDragEnd();
          tsCleanup();
        },
        { passive: true },
      );
