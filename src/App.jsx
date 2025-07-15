import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';

const WALL_COLORS = {
  N: '#20298C',
  H: '#190848',
  M: '#4A4897',
  X: '#FF4D4D'
};
const LANES = 6;
const MAX_WALLS = 6;
const ROTATIONS = 6;

function getWallTypeByRow(rowIndex) {
  switch (rowIndex) {
    case 0: return 'N';
    case 1: return 'H';
    case 2:
    case 3: return 'M';
    case 4: return 'H';
    case 5: return 'M';
    default: return 'M';
  }
}

function createEmptyBoard() {
  return Array(LANES).fill().map(() => []);
}

export default function App() {
  const [boards, setBoards] = useState(Array(ROTATIONS).fill().map(() => createEmptyBoard()));
  const [carryOver, setCarryOver] = useState(Array(ROTATIONS).fill().map(() => createEmptyBoard()));
  const [markMode, setMarkMode] = useState(false);
  const [wipe, setWipe] = useState(false);
  const exportRef = useRef(null);

  // Count walls in board
  const getWallCount = board => board.reduce((sum, lane) => sum + lane.length, 0);
  // Count breaks in board
  const getBreakCount = board => board.reduce((sum, lane) => sum + lane.filter(w => w.type === 'X').length, 0);
  // Count breaks in carryOver
  const getCarryBreakCount = carryBoard => carryBoard.reduce((sum, lane) => sum + lane.filter(w => w.type === 'X').length, 0);

  const placeWallAtLane = (rotationIndex, laneIndex) => {
    if (markMode) return;

    setBoards(prev => {
      const newBoards = [...prev];
      const board = [...newBoards[rotationIndex]];
      const carry = carryOver[rotationIndex]?.[laneIndex] || [];

      const placedCount = getWallCount(board);
      const breakCount = getBreakCount(board) + getCarryBreakCount(carryOver[rotationIndex]);
      // block if too many walls or breaks
      if (placedCount >= 11 || breakCount >= 7) return prev;

      if ((board[laneIndex]?.length || 0) + carry.length >= MAX_WALLS) {
        setWipe(true);
        return prev;
      }

      const rowIndex = (board[laneIndex]?.length || 0) + carry.length;
      const wallType = getWallTypeByRow(rowIndex);
      board[laneIndex] = [
        ...(board[laneIndex] || []),
        { type: wallType, source: 'placed' }
      ];
      newBoards[rotationIndex] = board;
      return newBoards;
    });
  };

  const markOrBreakWall = (rotationIndex, laneIndex) => {
    setBoards(prev => {
      const newBoards = [...prev];
      const board = [...newBoards[rotationIndex]];
      const placed = [...board[laneIndex]];
      const carry = [...(carryOver[rotationIndex]?.[laneIndex] || [])];

      const stack = [...carry, ...placed];
      const placedBreakCount = getBreakCount(board);
      const carryBreakCount = getCarryBreakCount(carryOver[rotationIndex]);
      const totalBreakCount = placedBreakCount + carryBreakCount;
      const placedCount = getWallCount(board);

      // block if already 7 breaks
      if (totalBreakCount >= 7) return prev;

      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].type !== 'X') {
          // mark this wall broken
          const newStack = [...stack];
          newStack[i] = { type: 'X', source: newStack[i].source };

          // split back into carry/placed
          const newCarry = newStack.slice(0, carry.length);
          const newPlaced = newStack.slice(carry.length);

          // update board for this rotation
          board[laneIndex] = newPlaced;
          newBoards[rotationIndex] = board;

          // update carryOver for this rotation
          const updatedCarryOver = [...carryOver];
          updatedCarryOver[rotationIndex] = [...updatedCarryOver[rotationIndex]];
          updatedCarryOver[rotationIndex][laneIndex] = newCarry;
          setCarryOver(updatedCarryOver);

          const newTotalBreaks = totalBreakCount + 1;
          // if exactly 7 breaks & ≥11 total walls, carry forward
          if (
            newTotalBreaks === 7 &&
            (placedCount + carryOver[rotationIndex].reduce((s, lane) => s + lane.length, 0)) >= 11 &&
            rotationIndex + 1 < ROTATIONS
          ) {
            const newNextCarry = createEmptyBoard();
            for (let j = 0; j < LANES; j++) {
              const cStack = carryOver[rotationIndex][j] || [];
              const pStack = board[j] || [];
              const filteredCarry = cStack.filter(w => w.type !== 'X');
              const filteredPlaced = pStack.filter(w => w.type !== 'X');
              newNextCarry[j] = [
                ...filteredCarry,
                ...filteredPlaced
              ]
                .map(w => ({ ...w, source: 'carry' }))
                .slice(0, MAX_WALLS);
            }
            setCarryOver(old => {
              const updated = [...old];
              updated[rotationIndex + 1] = newNextCarry;
              return updated;
            });
          }
          break;
        }
      }
      return newBoards;
    });
  };

  const removeWall = (rotationIndex, laneIndex, e) => {
    e.preventDefault();
    if (markMode) {
      // un-break the topmost broken wall
      setBoards(prev => {
        const newBoards = [...prev];
        const board = [...newBoards[rotationIndex]];
        const carry = [...(carryOver[rotationIndex]?.[laneIndex] || [])];
        const placed = [...board[laneIndex]];
        const stack = [...carry, ...placed];

        for (let i = 0; i < stack.length; i++) {
          if (stack[i].type === 'X') {
            stack[i] = { type: getWallTypeByRow(i), source: stack[i].source };
            break;
          }
        }

        // split back
        const newCarry = stack.slice(0, carry.length);
        const newPlaced = stack.slice(carry.length);

        board[laneIndex] = newPlaced;
        newBoards[rotationIndex] = board;

        // update carryOver
        const updatedCarryOver = [...carryOver];
        updatedCarryOver[rotationIndex] = [...updatedCarryOver[rotationIndex]];
        updatedCarryOver[rotationIndex][laneIndex] = newCarry;
        setCarryOver(updatedCarryOver);

        return newBoards;
      });
    } else {
      // pop only from placed
      setBoards(prev => {
        const newBoards = [...prev];
        const board = [...newBoards[rotationIndex]];
        const lane = [...board[laneIndex]];
        if (lane.length === 0) return prev;
        lane.pop();
        board[laneIndex] = lane;
        newBoards[rotationIndex] = board;
        return newBoards;
      });
    }
  };

  const reset = () => {
    setBoards(Array(ROTATIONS).fill().map(() => createEmptyBoard()));
    setCarryOver(Array(ROTATIONS).fill().map(() => createEmptyBoard()));
    setMarkMode(false);
    setWipe(false);
  };

  const exportAsImage = () => {
    if (exportRef.current) {
      html2canvas(exportRef.current).then(canvas => {
        const link = document.createElement('a');
        link.download = 'wall-simulation.png';
        link.href = canvas.toDataURL();
        link.click();
      });
    }
  };

  return (
    <div className="flex flex-col items-center p-4 min-h-screen bg-white">
      <div className="flex gap-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${markMode ? 'bg-red-500 text-white' : 'bg-gray-300'}`}
          onClick={() => setMarkMode(!markMode)}
        >
          {markMode ? 'Mark Mode: ON' : 'Mark Mode: OFF'}
        </button>
        <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={reset}>
          Reset
        </button>
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={exportAsImage}>
          Export
        </button>
      </div>

      {wipe && (
        <div className="text-red-600 font-bold mb-4">
          Wipe! A lane has 6 or more walls.
        </div>
      )}

      <div ref={exportRef} className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {boards.map((lanes, rotationIndex) => (
          <div key={rotationIndex} className="mb-12">
            <div className="text-lg font-bold mb-2">Rotation {rotationIndex + 1}</div>
            <div className="flex">
              <div className="flex flex-col mr-2 justify-between h-[204px]">
                {Array.from({ length: MAX_WALLS }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[32px] flex items-center justify-end pr-1 text-xs text-gray-700"
                  >
                    Row {MAX_WALLS - i}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-6 gap-4">
                {lanes.map((lane, laneIdx) => {
                  const merged = [
                    ...(carryOver[rotationIndex]?.[laneIdx] || []),
                    ...lane
                  ];
                  return (
                    <div
                      key={laneIdx}
                      className="border w-20 h-[204px] flex flex-col bg-gray-100"
                      onClick={() =>
                        markMode
                          ? markOrBreakWall(rotationIndex, laneIdx)
                          : placeWallAtLane(rotationIndex, laneIdx)
                      }
                      onContextMenu={e => removeWall(rotationIndex, laneIdx, e)}
                    >
                      {Array.from({ length: MAX_WALLS }).map((_, j) => {
                        const wall = merged[MAX_WALLS - 1 - j];
                        return (
                          <div
                            key={j}
                            className="h-[32px] flex items-center justify-center"
                          >
                            {wall && (
                              <div
                                className="w-5/6 h-full text-center rounded text-white text-xs leading-[32px]"
                                style={{ backgroundColor: WALL_COLORS[wall.type] || '#000' }}
                              >
                                {wall.type === 'X' ? 'Break' : wall.type}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
