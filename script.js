// =============================================
      // Supabase 설정
      // Supabase 대시보드 → Project Settings → API 에서 복사
      // =============================================
      const SUPABASE_URL = 'https://jcthdhhwydwbnppwzzey.supabase.co';
      const SUPABASE_ANON_KEY = 'sb_publishable_vF4WX27TEGBARd9Cx8ah_g_gRtfjwrx';
      const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      // game_sessions 테이블에서 가져온 활성 세션 ID
      let activeSessionId = null;

      let people = [];
      let pool = [];
      let courts = [];
      let courtCount = 0;
      let nextId = 1;
      let draggedId = null;
      let selectedId = null; // 클릭 선택된 대기 인원 ID
      let readyGroups = []; // 게임준비 대기조 (최대 10개) [{teamA:[], teamB:[]}]
      let draggedGroupIdx = null; // 대기조 헤더 드래그 인덱스
      let selectedGroupIdx = null; // 터치: 탭으로 선택된 대기조 인덱스

      /* ── 클릭 선택 관련 함수 ── */
      function deselectAll() {
        selectedId = null;
        document.body.classList.remove('has-selection');
        document.querySelectorAll('.p-badge.selected, .member-chip.selected').forEach(function (el) {
          el.classList.remove('selected');
        });
      }

      function deselectGroup() {
        selectedGroupIdx = null;
        document.body.classList.remove('has-group-selection');
        document.querySelectorAll('.ready-card.group-selected').forEach(function (el) {
          el.classList.remove('group-selected');
        });
      }

      /* ── 헬퍼: 사람 현재 위치에서 제거 ── */
      function _removePerson(p) {
        if (p.status === 'available') {
          pool = pool.filter(x => x.id !== p.id);
        } else if (p.status === 'team-a' || p.status === 'team-b') {
          const court = courts[p.groupNo];
          if (court) {
            if (p.status === 'team-a') court.teamA = court.teamA.filter(x => x.id !== p.id);
            else court.teamB = court.teamB.filter(x => x.id !== p.id);
          }
        } else if (p.status === 'ready-a' || p.status === 'ready-b') {
          const group = readyGroups[p.readyGroupNo];
          if (group) {
            if (p.status === 'ready-a') group.teamA = group.teamA.filter(x => x.id !== p.id);
            else group.teamB = group.teamB.filter(x => x.id !== p.id);
          }
        }
      }

      /* ── 헬퍼: 사람 지정 위치에 배치 ── */
      function _placePerson(p, status, groupNo, readyGroupNo) {
        p.status = status;
        p.groupNo = (groupNo != null) ? groupNo : null;
        p.readyGroupNo = (readyGroupNo != null) ? readyGroupNo : null;
        if (status === 'available') {
          pool.push(p);
        } else if (status === 'team-a' && groupNo != null) {
          courts[groupNo].teamA.push(p);
        } else if (status === 'team-b' && groupNo != null) {
          courts[groupNo].teamB.push(p);
        } else if (status === 'ready-a' && readyGroupNo != null) {
          readyGroups[readyGroupNo].teamA.push(p);
        } else if (status === 'ready-b' && readyGroupNo != null) {
          readyGroups[readyGroupNo].teamB.push(p);
        }
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
        const person = people.find(p => p.id === selectedId);
        if (!person) { deselectAll(); return; }
        const court = courts[courtIdx];
        if (!court) return;
        const teamArr = team === 'A' ? court.teamA : court.teamB;
        if (teamArr.length >= 2) { deselectAll(); return; }

        _removePerson(person);
        _placePerson(person, team === 'A' ? 'team-a' : 'team-b', courtIdx, null);
        deselectAll();
        render();
        syncState();
      }

      function onClickReadySlot(groupIdx, team) {
        if (selectedId === null) return;
        const person = people.find(p => p.id === selectedId);
        if (!person) { deselectAll(); return; }
        const group = readyGroups[groupIdx];
        if (!group) return;
        const teamArr = team === 'A' ? group.teamA : group.teamB;
        if (teamArr.length >= 2) { deselectAll(); return; }

        _removePerson(person);
        _placePerson(person, team === 'A' ? 'ready-a' : 'ready-b', null, groupIdx);
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

      /* ────── 비밀번호 입력 키보드 지원 ────── */
      document.getElementById('pw-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submitPassword(); }
        if (e.key === 'Escape') { e.preventDefault(); closePwModal(); }
      });

      /* ────── 인원 추가 ────── */
      async function addPerson() {
        const input = document.getElementById('name-input');
        const name = input.value.trim();
        if (!name) return;
        const p = {
          id: nextId++,
          dbId: null,
          name,
          gender: selectedGender,
          level: selectedLevel,
          status: 'available',
          groupNo: null,
          readyGroupNo: null,
        };
        people.push(p);
        pool.push(p);
        input.value = '';
        input.focus();
        render();

        // DB 회원 테이블에 게스트로 추가
        const { data: mData, error: mErr } = await db.from('members').insert({
          name,
          gender: selectedGender,
          level: selectedLevel,
          member_type: '게스트',
          is_active: true,
        }).select('id').single();
        if (mErr) {
          console.error('[addPerson] 게스트 추가 오류:', mErr);
        } else if (mData) {
          p.dbId = mData.id;
        }
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

      /* ────── 코트 삭제 ────── */
      function deleteCourt(courtIdx) {
        const court = courts[courtIdx];
        if (!court) return;
        // 해당 코트 인원 전원 대기 복귀
        [...court.teamA, ...court.teamB].forEach((p) => {
          p.status = 'available';
          p.groupNo = null;
          pool.push(p);
        });
        // 코트 제거
        courts.splice(courtIdx, 1);
        courtCount = courts.length;
        // 남은 코트 인원들의 groupNo 재정렬
        courts.forEach((c, ci) => {
          [...c.teamA, ...c.teamB].forEach((p) => { p.groupNo = ci; });
        });
        document.getElementById('court-input').value = courtCount || '';
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

      /* ────── 게임준비 대기조 관리 ────── */
      function addReadyGroup() {
        if (readyGroups.length >= 10) return;
        readyGroups.push({ teamA: [], teamB: [] });
        render();
      }

      function deleteReadyGroup(groupIdx) {
        const group = readyGroups[groupIdx];
        if (!group) return;
        [...group.teamA, ...group.teamB].forEach(p => {
          p.status = 'available';
          p.readyGroupNo = null;
          pool.push(p);
        });
        readyGroups.splice(groupIdx, 1);
        readyGroups.forEach((g, gi) => {
          [...g.teamA, ...g.teamB].forEach(p => { p.readyGroupNo = gi; });
        });
        render();
        syncState();
      }

      function returnAllFromReadyGroup(groupIdx) {
        const group = readyGroups[groupIdx];
        if (!group) return;
        [...group.teamA, ...group.teamB].forEach(p => {
          p.status = 'available';
          p.readyGroupNo = null;
          pool.push(p);
        });
        group.teamA = [];
        group.teamB = [];
        render();
        syncState();
      }

      function returnFromReadyGroup(personId) {
        const p = people.find(x => x.id === personId);
        if (!p || p.readyGroupNo === null) return;
        const group = readyGroups[p.readyGroupNo];
        if (group) {
          group.teamA = group.teamA.filter(x => x.id !== personId);
          group.teamB = group.teamB.filter(x => x.id !== personId);
        }
        p.status = 'available';
        p.readyGroupNo = null;
        pool.push(p);
        render();
        syncState();
      }

      /* ────── 게임준비 드래그 슬롯 ────── */
      function onDragOverReadySlot(e, groupIdx, team) {
        if (draggedId === null) return;
        const group = readyGroups[groupIdx];
        if (!group) return;
        const teamArr = team === 'A' ? group.teamA : group.teamB;
        if (teamArr.length < 2) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }
      }

      function onDropToReadySlot(e, groupIdx, team) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        if (draggedId === null) return;
        const person = people.find(p => p.id === draggedId);
        if (!person) { onDragEnd(); return; }
        const group = readyGroups[groupIdx];
        if (!group) { onDragEnd(); return; }
        const teamArr = team === 'A' ? group.teamA : group.teamB;
        if (teamArr.length >= 2) { onDragEnd(); return; }

        _removePerson(person);
        _placePerson(person, team === 'A' ? 'ready-a' : 'ready-b', null, groupIdx);
        onDragEnd();
        render();
        syncState();
      }

      /* ────── 대기조 헤더 드래그 → 코트 배정 ────── */
      function onDragStartGroup(e, groupIdx) {
        draggedGroupIdx = groupIdx;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'group-' + groupIdx);
        document.body.classList.add('is-dragging-group');
      }

      function onDragEndGroup() {
        draggedGroupIdx = null;
        document.body.classList.remove('is-dragging-group');
        document.querySelectorAll('.court-card.group-drag-over').forEach(el => el.classList.remove('group-drag-over'));
      }

      function onDragOverCourt(e) {
        if (draggedGroupIdx === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const card = e.currentTarget.closest('.court-card');
        if (card) card.classList.add('group-drag-over');
      }

      function onDragLeaveCourt(e) {
        const card = e.currentTarget.closest('.court-card');
        if (card && !card.contains(e.relatedTarget)) card.classList.remove('group-drag-over');
      }

      function onDragOverReadyCard(e, targetGroupIdx) {
        if (draggedGroupIdx === null || draggedGroupIdx === targetGroupIdx) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const card = e.currentTarget.closest('.court-card') || e.currentTarget;
        if (card) card.classList.add('group-drag-over');
      }

      function onDragLeaveReadyCard(e) {
        const card = e.currentTarget.closest('.court-card') || e.currentTarget;
        if (card && !card.contains(e.relatedTarget)) card.classList.remove('group-drag-over');
      }

      function onDropGroupToGroup(e, targetGroupIdx) {
        e.preventDefault();
        const card = e.currentTarget.closest ? e.currentTarget.closest('.court-card') : e.currentTarget;
        if (card) card.classList.remove('group-drag-over');
        if (draggedGroupIdx === null || draggedGroupIdx === targetGroupIdx) { onDragEndGroup(); return; }

        const srcIdx = draggedGroupIdx;
        const dstIdx = targetGroupIdx;

        // 두 대기조 스왑
        const temp = readyGroups[srcIdx];
        readyGroups[srcIdx] = readyGroups[dstIdx];
        readyGroups[dstIdx] = temp;

        // readyGroupNo 재할당
        [...readyGroups[srcIdx].teamA, ...readyGroups[srcIdx].teamB].forEach(p => { p.readyGroupNo = srcIdx; });
        [...readyGroups[dstIdx].teamA, ...readyGroups[dstIdx].teamB].forEach(p => { p.readyGroupNo = dstIdx; });

        onDragEndGroup();
        render();
        syncState();
      }

      function onDropGroupToCourt(e, courtIdx) {
        e.preventDefault();
        const card = e.currentTarget.closest ? e.currentTarget.closest('.court-card') : null;
        if (card) card.classList.remove('group-drag-over');
        if (draggedGroupIdx === null) return;

        const group = readyGroups[draggedGroupIdx];
        const court = courts[courtIdx];
        if (!group || !court) { onDragEndGroup(); return; }

        // 기존 코트 인원 → 대기로 복귀
        [...court.teamA, ...court.teamB].forEach(p => {
          p.status = 'available';
          p.groupNo = null;
          pool.push(p);
        });
        court.teamA = [];
        court.teamB = [];

        // 대기조 인원 → 코트로 이동
        [...group.teamA].forEach(p => {
          p.status = 'team-a';
          p.groupNo = courtIdx;
          p.readyGroupNo = null;
          court.teamA.push(p);
        });
        [...group.teamB].forEach(p => {
          p.status = 'team-b';
          p.groupNo = courtIdx;
          p.readyGroupNo = null;
          court.teamB.push(p);
        });

        // 대기조 제거 및 재번호
        const gIdx = draggedGroupIdx;
        readyGroups.splice(gIdx, 1);
        readyGroups.forEach((g, gi) => {
          [...g.teamA, ...g.teamB].forEach(p => { p.readyGroupNo = gi; });
        });

        onDragEndGroup();
        render();
        syncState();
      }

      /* ────── 터치: 대기조 탭 선택 → 코트 탭 배정 ────── */
      function onReadyHdrTap(groupIdx) {
        if (selectedGroupIdx === groupIdx) {
          deselectGroup();
        } else {
          deselectGroup();
          deselectAll();
          selectedGroupIdx = groupIdx;
          document.body.classList.add('has-group-selection');
          // 선택 표시
          const card = document.querySelector(`.ready-card[data-group-idx="${groupIdx}"]`);
          if (card) card.classList.add('group-selected');
        }
      }

      function onCourtCardTap(courtIdx) {
        if (selectedGroupIdx === null) return;
        draggedGroupIdx = selectedGroupIdx;
        onDropGroupToCourt({ preventDefault: function() {}, currentTarget: document.querySelector(`.court-card[data-court-idx="${courtIdx}"]`) || {} }, courtIdx);
        deselectGroup();
      }

      /* ────── 게임준비 대기조 개별 배정 ────── */
      function assignReadyGroup(groupIdx) {
        const group = readyGroups[groupIdx];
        if (!group || pool.length === 0) return;
        const emptyA = 2 - group.teamA.length;
        const emptyB = 2 - group.teamB.length;
        const totalEmpty = emptyA + emptyB;
        if (totalEmpty === 0) return;
        const shuffled = shuffle(pool);
        const toAssign = shuffled.slice(0, totalEmpty);
        let idx = 0;
        while (group.teamA.length < 2 && idx < toAssign.length) {
          const p = toAssign[idx++];
          _removePerson(p);
          _placePerson(p, 'ready-a', null, groupIdx);
        }
        while (group.teamB.length < 2 && idx < toAssign.length) {
          const p = toAssign[idx++];
          _removePerson(p);
          _placePerson(p, 'ready-b', null, groupIdx);
        }
        render();
        syncState();
      }

      function assignReadyGroupByGender(groupIdx, gender) {
        const group = readyGroups[groupIdx];
        if (!group) return;
        const genderPool = pool.filter(p => p.gender === gender);
        if (genderPool.length === 0) return;
        const emptyA = 2 - group.teamA.length;
        const emptyB = 2 - group.teamB.length;
        const totalEmpty = emptyA + emptyB;
        if (totalEmpty === 0) return;
        const shuffled = shuffle(genderPool);
        const toAssign = shuffled.slice(0, totalEmpty);
        let idx = 0;
        while (group.teamA.length < 2 && idx < toAssign.length) {
          const p = toAssign[idx++];
          _removePerson(p);
          _placePerson(p, 'ready-a', null, groupIdx);
        }
        while (group.teamB.length < 2 && idx < toAssign.length) {
          const p = toAssign[idx++];
          _removePerson(p);
          _placePerson(p, 'ready-b', null, groupIdx);
        }
        render();
        syncState();
      }

      function assignReadyGroupMixed(groupIdx) {
        const group = readyGroups[groupIdx];
        if (!group) return;
        const males = shuffle(pool.filter(p => p.gender === '남'));
        const females = shuffle(pool.filter(p => p.gender === '여'));
        if (males.length === 0 || females.length === 0) return;
        const toAssign = [];
        let mi = 0, fi = 0;
        const fillTeam = (emptyCount, team) => {
          let needMale = true;
          for (let i = 0; i < emptyCount; i++) {
            if (needMale && mi < males.length) toAssign.push({ person: males[mi++], team });
            else if (!needMale && fi < females.length) toAssign.push({ person: females[fi++], team });
            else if (mi < males.length) toAssign.push({ person: males[mi++], team });
            else if (fi < females.length) toAssign.push({ person: females[fi++], team });
            needMale = !needMale;
          }
        };
        fillTeam(2 - group.teamA.length, 'A');
        fillTeam(2 - group.teamB.length, 'B');
        for (const { person, team } of toAssign) {
          _removePerson(person);
          _placePerson(person, team === 'A' ? 'ready-a' : 'ready-b', null, groupIdx);
        }
        render();
        syncState();
      }

      /* ────── 랜덤 배정: 대기 인원 → 기존 대기조 빈 슬롯만 채우기 ────── */
      function assignCourts() {
        if (pool.length === 0) return;
        const existingSlots = readyGroups.reduce((s, g) => s + (4 - g.teamA.length - g.teamB.length), 0);
        if (existingSlots === 0) return;

        const shuffled = shuffle(pool);
        let idx = 0;

        for (let gi = 0; gi < readyGroups.length && idx < shuffled.length; gi++) {
          const group = readyGroups[gi];
          while (group.teamA.length < 2 && idx < shuffled.length) {
            const p = shuffled[idx++];
            _removePerson(p);
            _placePerson(p, 'ready-a', null, gi);
          }
          while (group.teamB.length < 2 && idx < shuffled.length) {
            const p = shuffled[idx++];
            _removePerson(p);
            _placePerson(p, 'ready-b', null, gi);
          }
        }

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

        const person = people.find(p => p.id === draggedId);
        if (!person) { onDragEnd(); return; }
        const court = courts[courtIdx];
        if (!court) { onDragEnd(); return; }
        const teamArr = team === 'A' ? court.teamA : court.teamB;
        if (teamArr.length >= 2) { onDragEnd(); return; }

        _removePerson(person);
        _placePerson(person, team === 'A' ? 'team-a' : 'team-b', courtIdx, null);
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

        const dragged = people.find(p => p.id === draggedId);
        const target = people.find(p => p.id === targetPersonId);
        if (!dragged || !target) { onDragEnd(); return; }

        // 위치 정보 저장 후 두 사람 제거
        const dStatus = dragged.status, dGroupNo = dragged.groupNo, dReadyGroupNo = dragged.readyGroupNo;
        const tStatus = target.status, tGroupNo = target.groupNo, tReadyGroupNo = target.readyGroupNo;
        _removePerson(dragged);
        _removePerson(target);

        // 서로 위치 스왑
        _placePerson(dragged, tStatus, tGroupNo, tReadyGroupNo);
        _placePerson(target, dStatus, dGroupNo, dReadyGroupNo);

        onDragEnd();
        render();
        syncState();
      }

      /* ────── 비밀번호 확인 모달 ────── */
      const PW_CORRECT = 'sdf';
      let _pwCallback = null;

      function requirePassword(callback) {
        _pwCallback = callback;
        const overlay = document.getElementById('pw-modal-overlay');
        const input = document.getElementById('pw-input');
        const error = document.getElementById('pw-error');
        input.value = '';
        input.classList.remove('error');
        error.textContent = '';
        overlay.classList.add('show');
        requestAnimationFrame(() => input.focus());
      }

      function closePwModal() {
        const overlay = document.getElementById('pw-modal-overlay');
        const input = document.getElementById('pw-input');
        const error = document.getElementById('pw-error');
        overlay.classList.remove('show');
        input.value = '';
        input.classList.remove('error');
        error.textContent = '';
        _pwCallback = null;
      }

      function submitPassword() {
        const input = document.getElementById('pw-input');
        const error = document.getElementById('pw-error');
        if (input.value === PW_CORRECT) {
          const callback = _pwCallback;
          closePwModal();
          if (typeof callback === 'function') callback();
        } else {
          error.textContent = '비밀번호가 올바르지 않습니다.';
          input.classList.add('error');
          input.value = '';
          input.focus();
          setTimeout(() => input.classList.remove('error'), 300);
        }
      }

      /* ────── 초기화 모달 ────── */
      function resetAll() {
        document.getElementById('modal-overlay').classList.add('show');
      }

      function closeModal() {
        document.getElementById('modal-overlay').classList.remove('show');
      }

      async function confirmReset() {
        people = [];
        pool = [];
        courts = [];
        readyGroups = [];
        courtCount = 0;
        nextId = 1;
        draggedId = null;
        selectedId = null;
        draggedGroupIdx = null;
        selectedGroupIdx = null;
        document.body.classList.remove('is-dragging', 'has-selection', 'is-dragging-group', 'has-group-selection');
        closeModal();

        // 게스트 데이터 삭제
        const { error: delErr } = await db.from('members').delete().eq('member_type', '게스트');
        if (delErr) console.error('[reset] 게스트 삭제 오류:', delErr);

        // 코트 기본 6개 생성
        for (let i = 0; i < 6; i++) courts.push({ teamA: [], teamB: [] });
        courtCount = 6;
        document.getElementById('court-input').value = '6';
        localStorage.setItem('courtCount', '6');

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
            const p = { id: nextId++, name: maleNames[mi++], gender: '남', level, status: 'available', groupNo: null, readyGroupNo: null };
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
              readyGroupNo: null,
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
        const original = btn.textContent;

        btn.disabled = true;
        btn.textContent = '불러오는 중...';

        const { data, error } = await db.from('members').select('id, name, gender, level')
          .eq('is_active', true).eq('member_type', '회원');

        btn.disabled = false;
        btn.textContent = original;

        if (error) {
          console.error('회원 조회 실패:', error);
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
            readyGroupNo: null,
          };
          people.push(p);
          pool.push(p);
          added++;
        });

        render();
        if (added > 0) {
          syncState();
          btn.textContent = `✔ ${added}명 추가됨`;
          setTimeout(() => { btn.textContent = original; }, 2000);
        }
      }

      /* ────── DB: 상태 동기화 & 복원 ────── */

      // syncState debounce: 연속 호출 시 마지막 1회만 실행 (race condition 방지)
      let _syncTimer = null;
      function syncState() {
        clearTimeout(_syncTimer);
        _syncTimer = setTimeout(_doSync, 300);
      }

      async function _doSync() {
        try {
          // 1. court_assignments → session_participants 순서로 삭제 (FK: court_assignments.participant_id → session_participants.id)
          if (activeSessionId) {
            const { error: caDelErr } = await db.from('court_assignments').delete().eq('session_id', activeSessionId);
            if (caDelErr) { console.error('[sync] court_assignments 삭제 오류:', caDelErr); return; }
            const { error: spDelErr } = await db.from('session_participants').delete().eq('session_id', activeSessionId);
            if (spDelErr) { console.error('[sync] session_participants 삭제 오류:', spDelErr); return; }
          }

          // 2. waiting_queue, courts, ready_queue 동시 삭제
          const [wqDel, cDel, rqDel] = await Promise.all([
            db.from('waiting_queue').delete().not('id', 'is', null),
            db.from('courts').delete().not('id', 'is', null),
            db.from('ready_queue').delete().not('id', 'is', null),
          ]);
          if (wqDel.error) { console.error('[sync] waiting_queue 삭제 오류:', wqDel.error); return; }
          if (cDel.error) { console.error('[sync] courts 삭제 오류:', cDel.error); return; }
          if (rqDel.error) { console.error('[sync] ready_queue 삭제 오류:', rqDel.error); }

          // 3. courts 테이블 동기화 (DB는 1-indexed)
          if (courts.length > 0) {
            const courtRows = courts.map((_, i) => ({
              court_number: i + 1,
              court_name: `코트 ${i + 1}`,
              is_active: true,
            }));
            const { error: cErr } = await db.from('courts').insert(courtRows);
            if (cErr) { console.error('[sync] courts 삽입 오류:', cErr); return; }
          }

          // 4. session_participants 동기화 (dbId 있는 모든 인원 → members.id 기반)
          //    court_assignments.participant_id는 session_participants.id를 FK로 참조함
          let memberIdToSpId = {}; // members.id → session_participants.id
          if (activeSessionId) {
            const allDbPeople = people.filter((p) => p.dbId);
            if (allDbPeople.length > 0) {
              const spRows = allDbPeople.map((p) => ({
                session_id: activeSessionId,
                member_id: p.dbId,
                name: p.name,
                gender: p.gender,
                level: p.level,
              }));
              const { data: spData, error: spErr } = await db.from('session_participants').insert(spRows).select('id, member_id');
              if (spErr) { console.error('[sync] session_participants 삽입 오류:', spErr); return; }
              (spData || []).forEach((sp) => { memberIdToSpId[sp.member_id] = sp.id; });
            }
          }

          // 5. waiting_queue 동기화
          const waitingRows = pool.map((p) => ({
            member_id: p.dbId || null,
            name: p.name,
            gender: p.gender,
            level: p.level,
          }));

          // 6. court_assignments 동기화 (session_participants.id를 participant_id로 사용)
          if (activeSessionId) {
            const assignedRows = [];
            courts.forEach((court, ci) => {
              court.teamA.forEach((p) => {
                const spId = p.dbId ? memberIdToSpId[p.dbId] : null;
                if (spId) assignedRows.push({ session_id: activeSessionId, court_number: ci + 1, team: 'A', participant_id: spId });
              });
              court.teamB.forEach((p) => {
                const spId = p.dbId ? memberIdToSpId[p.dbId] : null;
                if (spId) assignedRows.push({ session_id: activeSessionId, court_number: ci + 1, team: 'B', participant_id: spId });
              });
            });
            if (assignedRows.length > 0) {
              const { error: caErr } = await db.from('court_assignments').insert(assignedRows);
              if (caErr) { console.error('[sync] court_assignments 삽입 오류:', caErr); return; }
            }
          }

          if (waitingRows.length > 0) {
            const { error: wqErr } = await db.from('waiting_queue').insert(waitingRows);
            if (wqErr) { console.error('[sync] waiting_queue 삽입 오류:', wqErr); return; }
          }

          // 7. ready_queue 동기화
          const readyRows = [];
          readyGroups.forEach((group, gi) => {
            group.teamA.forEach(p => readyRows.push({
              session_id: activeSessionId || null,
              group_number: gi + 1,
              team: 'A',
              member_id: p.dbId || null,
              name: p.name,
              gender: p.gender,
              level: p.level,
            }));
            group.teamB.forEach(p => readyRows.push({
              session_id: activeSessionId || null,
              group_number: gi + 1,
              team: 'B',
              member_id: p.dbId || null,
              name: p.name,
              gender: p.gender,
              level: p.level,
            }));
          });
          if (readyRows.length > 0) {
            const { error: rqErr } = await db.from('ready_queue').insert(readyRows);
            if (rqErr) { console.error('[sync] ready_queue 삽입 오류:', rqErr); }
          }

          // 8. game_sessions.court_count 동기화
          if (activeSessionId) {
            const { error: gsErr } = await db.from('game_sessions')
              .update({ court_count: courtCount, updated_at: new Date().toISOString() })
              .eq('id', activeSessionId);
            if (gsErr) console.error('[sync] game_sessions 업데이트 오류:', gsErr);
          }

          localStorage.setItem('courtCount', courtCount);
        } catch (err) {
          console.error('[sync] DB 동기화 오류:', err);
        }
      }

      /* ────── DB: 페이지 로드 시 상태 복원 ────── */
      async function loadState() {
        // game_sessions에서 오늘 진행중 세션 조회, 없으면 자동 생성
        const today = new Date().toISOString().split('T')[0];
        const { data: sessions, error: sessErr } = await db
          .from('game_sessions')
          .select('id, court_count')
          .eq('session_date', today)
          .eq('status', '진행중')
          .order('created_at', { ascending: false })
          .limit(1);

        if (sessErr) {
          console.error('[loadState] game_sessions 조회 오류:', sessErr);
          // 조회 자체가 실패하면 세션 생성 시도하지 않음 (RLS 등 권한 문제)
        } else if (sessions && sessions.length > 0) {
          activeSessionId = sessions[0].id;
          console.log('[session] 기존 세션 사용:', activeSessionId);
        } else {
          // 오늘 세션이 없으면 자동 생성
          // ※ 실패 시: Supabase에서 game_sessions 테이블에 anon INSERT 정책 추가 필요
          //   SQL: CREATE POLICY "anon_all" ON game_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
          const { data: newSess, error: createErr } = await db
            .from('game_sessions')
            .insert({ session_name: `${today} 배드민턴` })
            .select('id')
            .single();
          if (createErr) {
            console.error('[session] 세션 생성 오류 (game_sessions anon INSERT 정책 확인 필요):', createErr);
          } else {
            activeSessionId = newSess.id;
            console.log('[session] 새 세션 생성:', activeSessionId);
          }
        }

        const [wqCheck, caCheck, cCheck, spCheck, rqCheck] = await Promise.all([
          db.from('waiting_queue').select('id').limit(1),
          db.from('court_assignments').select('id').limit(1),
          db.from('courts').select('id').limit(1),
          db.from('session_participants').select('id').limit(1),
          db.from('ready_queue').select('id').limit(1),
        ]);

        if (wqCheck.error) console.error('[loadState] waiting_queue 접근 오류:', wqCheck.error);
        if (caCheck.error) console.error('[loadState] court_assignments 접근 오류:', caCheck.error);
        if (cCheck.error)  console.error('[loadState] courts 접근 오류:', cCheck.error);
        if (spCheck.error) console.error('[loadState] session_participants 접근 오류:', spCheck.error);
        if (rqCheck.error) console.warn('[loadState] ready_queue 접근 오류 (테이블 미생성 가능):', rqCheck.error);

        if (wqCheck.error || caCheck.error || cCheck.error || spCheck.error) {
          render();
          return;
        }

        const caQuery = activeSessionId
          ? db.from('court_assignments').select('court_number, team, participant_id').eq('session_id', activeSessionId)
          : db.from('court_assignments').select('court_number, team, participant_id').limit(0);

        const rqQuery = !rqCheck.error
          ? db.from('ready_queue').select('*').order('group_number').order('created_at')
          : Promise.resolve({ data: [], error: null });

        const [{ data: wqData, error: wqErr }, { data: caData, error: caErr }, { data: cData, error: cErr }, { data: rqData }] = await Promise.all([
          db.from('waiting_queue').select('*').order('created_at'),
          caQuery,
          db.from('courts').select('*').order('court_number'),
          rqQuery,
        ]);

        if (wqErr) { console.error('[loadState] waiting_queue 조회 오류:', wqErr); }
        if (caErr) { console.error('[loadState] court_assignments 조회 오류:', caErr); }
        if (cErr)  { console.error('[loadState] courts 조회 오류:', cErr); }

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

        // courts 테이블 기준으로 코트 수 복원 (DB는 1-indexed → 개수로 사용)
        const savedCount = parseInt(localStorage.getItem('courtCount')) || 0;
        if (cData && cData.length > 0) {
          courtCount = cData.length;
        } else {
          // court_number는 1-indexed이므로 max값이 곧 코트 수
          const maxCourt = (caData || []).reduce((m, r) => Math.max(m, r.court_number ?? 0), 0);
          courtCount = Math.max(maxCourt, savedCount);
        }
        while (courts.length < courtCount) courts.push({ teamA: [], teamB: [] });
        if (courtCount > 0) document.getElementById('court-input').value = courtCount;

        // participant_id (= session_participants.id) → member_id → members 순서로 조회
        const participantIds = (caData || []).map((r) => r.participant_id).filter(Boolean);
        let spMap = {}; // session_participants.id → members.id
        if (participantIds.length > 0) {
          const { data: spData, error: spErr } = await db
            .from('session_participants')
            .select('id, member_id')
            .in('id', participantIds);
          if (spErr) { console.error('[loadState] session_participants 조회 오류:', spErr); }
          (spData || []).forEach((sp) => { spMap[sp.id] = sp.member_id; });
        }

        const memberIds = [...new Set(Object.values(spMap).filter(Boolean))];
        let memberMap = {};
        if (memberIds.length > 0) {
          const { data: mData, error: mErr } = await db
            .from('members')
            .select('id, name, gender, level')
            .in('id', memberIds);
          if (mErr) { console.error('[loadState] members 조회 오류:', mErr); }
          (mData || []).forEach((m) => { memberMap[m.id] = m; });
        }

        (caData || []).forEach((row) => {
          if (row.court_number == null || row.team == null) return;
          const memberId = spMap[row.participant_id]; // session_participants.id → members.id
          const member = memberId ? memberMap[memberId] : null;
          if (!member) return;
          // DB는 1-indexed → 0-indexed로 변환
          const courtIdx = row.court_number - 1;
          const p = {
            id: nextId++,
            dbId: memberId,  // members.id 저장
            name: member.name,
            gender: member.gender || '남',
            level: member.level || 'A',
            status: row.team === 'A' ? 'team-a' : 'team-b',
            groupNo: courtIdx,
          };
          people.push(p);
          const court = courts[courtIdx];
          if (court) (row.team === 'A' ? court.teamA : court.teamB).push(p);
        });

        // ready_queue → readyGroups 복원
        readyGroups = [];
        (rqData || []).forEach((row) => {
          const gi = row.group_number - 1; // 1-indexed → 0-indexed
          while (readyGroups.length <= gi) readyGroups.push({ teamA: [], teamB: [] });
          const p = {
            id: nextId++,
            dbId: row.member_id || null,
            name: row.name,
            gender: row.gender || '남',
            level: row.level || 'A',
            status: row.team === 'A' ? 'ready-a' : 'ready-b',
            groupNo: null,
            readyGroupNo: gi,
          };
          people.push(p);
          if (row.team === 'A') readyGroups[gi].teamA.push(p);
          else readyGroups[gi].teamB.push(p);
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

        // 기존 대기조 빈 슬롯 수 계산 (새 대기조 생성 없음)
        const existingReadySlots = readyGroups.reduce((s, g) => s + (4 - g.teamA.length - g.teamB.length), 0);
        const canAssign = pool.length > 0 && existingReadySlots > 0;

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
        if (pool.length === 0) {
          btn.textContent = '대기 인원 없음';
        } else if (readyGroups.length === 0) {
          btn.textContent = '대기조 없음';
        } else if (existingReadySlots === 0) {
          btn.textContent = '대기조 모두 완료';
        } else {
          const fills = Math.min(pool.length, existingReadySlots);
          btn.textContent = `랜덤 배정 (${fills}명 → ${readyGroups.length}개 대기조)`;
        }

        // ── 게임준비 섹션 ──
        const readyGrid = document.getElementById('ready-grid');
        const btnAddReady = document.getElementById('btn-add-ready');
        if (btnAddReady) btnAddReady.disabled = readyGroups.length >= 10;
        if (readyGroups.length === 0) {
          readyGrid.innerHTML = '<div class="empty-msg">+ 대기조 추가 버튼으로 게임을 준비하세요.</div>';
        } else {
          const maleInPool2 = pool.filter(p => p.gender === '남').length;
          const femaleInPool2 = pool.filter(p => p.gender === '여').length;
          readyGrid.innerHTML = readyGroups.map((group, gi) => {
            const renderReadySlots = (teamArr, team) => {
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
                              ondblclick="returnFromReadyGroup(${p.id})"
                              title="더블클릭: 대기로 복귀  |  드래그: 이동">${p.name}${infoTag(p)}</div><br>`;
              }
              const emptyCount = 2 - teamArr.length;
              for (let i = 0; i < emptyCount; i++) {
                html += `<div
                              class="drop-slot"
                              data-slot-group="${gi}"
                              data-slot-team="${team}"
                              ondragover="onDragOverReadySlot(event,${gi},'${team}')"
                              ondrop="onDropToReadySlot(event,${gi},'${team}')"
                              ondragenter="onSlotEnter(event)"
                              ondragleave="onSlotLeave(event)"
                              onclick="onClickReadySlot(${gi},'${team}')"
                          >빈 자리</div><br>`;
              }
              return html;
            };
            const rtotal = group.teamA.length + group.teamB.length;
            const risFull = rtotal === 4;
            return `
              <div class="court-card ready-card${risFull ? ' full' : ''}" data-group-idx="${gi}"
                  ondragover="onDragOverReadyCard(event,${gi})"
                  ondragleave="onDragLeaveReadyCard(event)"
                  ondrop="onDropGroupToGroup(event,${gi})">
                  <div class="ready-hdr"
                      data-group-idx="${gi}"
                      draggable="true"
                      onclick="onReadyHdrTap(${gi})"
                      ondragstart="onDragStartGroup(event,${gi})"
                      ondragend="onDragEndGroup()"
                      ondblclick="returnAllFromReadyGroup(${gi})"
                      title="클릭→선택 후 코트 탭  |  드래그→코트에 배정  |  더블클릭→전원 복귀">
                      <span>대기 ${gi + 1}조</span>
                      <div class="court-hdr-right">
                          <div class="court-hdr-btns">
                              <button class="btn-court-assign"
                                  onclick="event.stopPropagation(); assignReadyGroup(${gi})"
                                  ondblclick="event.stopPropagation()"
                                  ${risFull || pool.length === 0 ? 'disabled' : ''}
                              >랜덤</button>
                              <button class="btn-court-assign male"
                                  onclick="event.stopPropagation(); assignReadyGroupByGender(${gi},'남')"
                                  ondblclick="event.stopPropagation()"
                                  ${risFull || maleInPool2 === 0 ? 'disabled' : ''}
                              >남복</button>
                              <button class="btn-court-assign female"
                                  onclick="event.stopPropagation(); assignReadyGroupByGender(${gi},'여')"
                                  ondblclick="event.stopPropagation()"
                                  ${risFull || femaleInPool2 === 0 ? 'disabled' : ''}
                              >여복</button>
                              <button class="btn-court-assign mixed"
                                  onclick="event.stopPropagation(); assignReadyGroupMixed(${gi})"
                                  ondblclick="event.stopPropagation()"
                                  ${risFull || maleInPool2 === 0 || femaleInPool2 === 0 ? 'disabled' : ''}
                              >혼복</button>
                              <button class="btn-court-delete"
                                  onclick="event.stopPropagation(); deleteReadyGroup(${gi})"
                                  ondblclick="event.stopPropagation()"
                                  title="대기조 삭제 (배정 인원 대기 복귀)"
                              >✕</button>
                          </div>
                          <span class="chint">
                              ${risFull ? '✔ 준비완료' : `${rtotal}/4명`}
                              &nbsp;|&nbsp; 클릭 → 코트 배정
                          </span>
                      </div>
                  </div>
                  <div class="court-body">
                      <div class="team-box ta">
                          <div class="team-lbl">A팀</div>
                          ${renderReadySlots(group.teamA, 'A')}
                      </div>
                      <div class="vs-col">VS</div>
                      <div class="team-box tb">
                          <div class="team-lbl">B팀</div>
                          ${renderReadySlots(group.teamB, 'B')}
                      </div>
                  </div>
              </div>`;
          }).join('');
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
                    <div class="court-card${isFull ? ' full' : ''}"
                        data-court-idx="${ci}"
                        ondragover="onDragOverCourt(event)"
                        ondragleave="onDragLeaveCourt(event)"
                        ondrop="onDropGroupToCourt(event,${ci})"
                        onclick="onCourtCardTap(${ci})">
                        <div class="court-hdr"
                            data-court-idx="${ci}"
                            ondblclick="returnAllFromCourt(${ci})"
                            title="더블클릭: 전원 대기로 복귀">
                            <span>${ci + 1}번 </span>
                            <div class="court-hdr-right">
                                <div class="court-hdr-btns">
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
                                    <button class="btn-court-delete"
                                        onclick="event.stopPropagation(); deleteCourt(${ci})"
                                        ondblclick="event.stopPropagation()"
                                        title="코트 삭제 (배정 인원 대기 복귀)"
                                    >✕</button>
                                </div>
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
        groupIdx: null,  // 그룹 드래그 시 사용
        isGroup: false,  // true: 대기조 헤더 드래그
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
        draggedGroupIdx = null;
        ts.personId = null;
        ts.groupIdx = null;
        ts.isGroup = false;
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
          const readyHdr = !draggable && !assigned && !hdr && e.target.closest('.ready-hdr[data-group-idx]');
          if (!draggable && !assigned && !hdr && !readyHdr) return;

          const t = e.touches[0];
          ts.startX = ts.lastX = t.clientX;
          ts.startY = ts.lastY = t.clientY;
          ts.ready = ts.dragging = false;

          if (draggable || assigned) {
            ts.el = draggable || assigned;
            ts.personId = parseInt(ts.el.dataset.id);
            ts.isGroup = false;

            // 대기 인원: 삭제 / 코트/게임준비 멤버: 대기 복귀
            if (draggable && draggable.classList.contains('available')) {
              ts.longAction = () => removePerson(ts.personId);
            } else {
              const pid = ts.personId;
              const pp = people.find(x => x.id === pid);
              ts.longAction = (pp && (pp.status === 'ready-a' || pp.status === 'ready-b'))
                ? () => returnFromReadyGroup(pid)
                : () => returnFromCourt(pid);
            }

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
            ts.isGroup = false;
            var ci = parseInt(hdr.dataset.courtIdx);
            ts.actionTimer = setTimeout(function () {
              if (!ts.dragging) {
                if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
                tsCleanup();
                returnAllFromCourt(ci);
              }
            }, 700);
          } else if (readyHdr) {
            ts.el = readyHdr;
            ts.isGroup = true;
            ts.groupIdx = parseInt(readyHdr.dataset.groupIdx);

            // 300ms → 그룹 드래그 준비
            ts.readyTimer = setTimeout(function () {
              if (!ts.dragging) {
                ts.ready = true;
                ts.el.classList.add('touch-drag-ready');
                if (navigator.vibrate) navigator.vibrate(30);
              }
            }, 300);

            // 700ms → 전원 대기 복귀
            ts.actionTimer = setTimeout(function () {
              if (!ts.dragging) {
                if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
                var gi = ts.groupIdx;
                tsCleanup();
                returnAllFromReadyGroup(gi);
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
          if (ts.ready && !ts.dragging && dist > 4 && (ts.personId !== null || ts.isGroup)) {
            clearTimeout(ts.actionTimer);
            ts.actionTimer = null;
            ts.dragging = true;
            if (ts.isGroup) {
              draggedGroupIdx = ts.groupIdx;
              document.body.classList.add('is-dragging-group');
            } else {
              draggedId = ts.personId;
              document.body.classList.add('is-dragging');
            }
            ts.el.classList.remove('touch-drag-ready');
            ts.el.classList.add('dragging');

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

            if (ts.isGroup) {
              // 그룹 드래그: 코트 카드 또는 대기조 카드 강조
              document.querySelectorAll('.court-card.group-drag-over').forEach(function (el) {
                el.classList.remove('group-drag-over');
              });
              if (under) {
                var courtCard = under.closest('.court-card[data-court-idx]');
                var readyCardOver = !courtCard && under.closest('.court-card[data-group-idx]');
                if (courtCard) {
                  courtCard.classList.add('group-drag-over');
                } else if (readyCardOver && parseInt(readyCardOver.dataset.groupIdx) !== draggedGroupIdx) {
                  readyCardOver.classList.add('group-drag-over');
                }
              }
            } else {
              // 인원 드래그: 슬롯/멤버칩 강조
              document.querySelectorAll('.drop-slot.drag-over, .member-chip.drag-over').forEach(function (el) {
                el.classList.remove('drag-over');
              });
              if (under) {
                var slot = under.closest('.drop-slot[data-slot-court], .drop-slot[data-slot-group]');
                var chip = under.closest('.member-chip[data-id]');
                if (slot) slot.classList.add('drag-over');
                else if (chip && parseInt(chip.dataset.id) !== ts.personId) chip.classList.add('drag-over');
              }
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
            document.querySelectorAll('.court-card.group-drag-over').forEach(function (el) {
              el.classList.remove('group-drag-over');
            });

            var acted = false;
            if (under) {
              if (ts.isGroup) {
                // 그룹 드래그: 코트 카드 또는 대기조 카드에 드롭
                var courtCard = under.closest('.court-card[data-court-idx]');
                var readyCardDst = !courtCard && under.closest('.court-card[data-group-idx]');
                if (courtCard) {
                  var courtIdx2 = parseInt(courtCard.dataset.courtIdx);
                  onDropGroupToCourt({ preventDefault: function () {}, currentTarget: courtCard }, courtIdx2);
                  acted = true;
                } else if (readyCardDst) {
                  var targetGi = parseInt(readyCardDst.dataset.groupIdx);
                  onDropGroupToGroup({ preventDefault: function () {}, currentTarget: readyCardDst }, targetGi);
                  acted = true;
                }
              } else {
                // 인원 드래그: 코트/게임준비 슬롯 또는 멤버칩에 드롭
                var slot = under.closest('.drop-slot[data-slot-court]');
                var readySlot = !slot && under.closest('.drop-slot[data-slot-group]');
                var chip = !slot && !readySlot && under.closest('.member-chip[data-id]');
                if (slot) {
                  onDropSlot(
                    { preventDefault: function () {}, currentTarget: slot },
                    parseInt(slot.dataset.slotCourt),
                    slot.dataset.slotTeam,
                  );
                  acted = true;
                } else if (readySlot) {
                  onDropToReadySlot(
                    { preventDefault: function () {}, currentTarget: readySlot },
                    parseInt(readySlot.dataset.slotGroup),
                    readySlot.dataset.slotTeam,
                  );
                  acted = true;
                } else if (chip && parseInt(chip.dataset.id) !== ts.personId) {
                  onDropMember({ preventDefault: function () {}, currentTarget: chip }, parseInt(chip.dataset.id));
                  acted = true;
                }
              }
            }
            if (!acted) {
              if (ts.isGroup) onDragEndGroup();
              else onDragEnd();
            }
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
