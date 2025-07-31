"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Pause, Play, RotateCcw, Trophy, Zap, Bomb, Sparkles, Target } from "lucide-react"

// Block shapes (non-rotatable)
const BLOCK_SHAPES = [
  [[1]],
  [[1, 1]],
  [[1, 1, 1]],
  [[1, 1, 1, 1]],
  [[1], [1]],
  [[1], [1], [1]],
  [[1], [1], [1], [1]],
  [
    [1, 1],
    [1, 0],
  ],
  [
    [1, 0],
    [1, 1],
  ],
  [
    [1, 1],
    [0, 1],
  ],
  [
    [0, 1],
    [1, 1],
  ],
  [
    [1, 1, 1],
    [0, 1, 0],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 0],
  ],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [1, 1, 1],
    [1, 1, 1],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
]

const COLORS = [
  "bg-cyan-400",
  "bg-pink-400",
  "bg-yellow-400",
  "bg-green-400",
  "bg-purple-400",
  "bg-orange-400",
  "bg-red-400",
  "bg-blue-400",
]

const POWER_BLOCK_TYPES = {
  BOMB: "bomb",
  LIGHTNING: "lightning",
  RAINBOW: "rainbow",
  DRILL: "drill",
}

type PowerBlockType = "bomb" | "lightning" | "rainbow" | "drill" | null

type Block = {
  id: string
  shape: number[][]
  color: string
  powerType?: PowerBlockType
}

type GridCell = {
  filled: boolean
  color: string
  powerType?: PowerBlockType
  isAnimating?: boolean
}

export default function BlockBlastGame() {
  const [grid, setGrid] = useState<GridCell[][]>(() =>
    Array(8)
      .fill(null)
      .map(() =>
        Array(8)
          .fill(null)
          .map(() => ({ filled: false, color: "", powerType: null })),
      ),
  )
  const [currentBlocks, setCurrentBlocks] = useState<Block[]>([])
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [draggedBlock, setDraggedBlock] = useState<Block | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ row: number; col: number } | null>(null)
  const [clearedLines, setClearedLines] = useState(0)
  const [combo, setCombo] = useState(0)
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const [isValidPlacement, setIsValidPlacement] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [particles, setParticles] = useState<Array<{ id: string; x: number; y: number; color: string }>>([])
  const [scorePopup, setScorePopup] = useState<{ points: number; x: number; y: number } | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)

  // Generate random blocks with chance for power blocks
  const generateBlocks = useCallback((): Block[] => {
    return Array(3)
      .fill(null)
      .map((_, index) => {
        const shape = BLOCK_SHAPES[Math.floor(Math.random() * BLOCK_SHAPES.length)]
        const color = COLORS[Math.floor(Math.random() * COLORS.length)]

        // 15% chance for power block
        let powerType: PowerBlockType = null
        if (Math.random() < 0.15) {
          const powerTypes = Object.values(POWER_BLOCK_TYPES)
          powerType = powerTypes[Math.floor(Math.random() * powerTypes.length)] as PowerBlockType
        }

        return {
          id: `block-${Date.now()}-${index}`,
          shape,
          color: powerType ? "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600" : color,
          powerType,
        }
      })
  }, [])

  // Initialize game
  useEffect(() => {
    setCurrentBlocks(generateBlocks())
  }, [generateBlocks])

  // Check if block can be placed at position
  const canPlaceBlock = useCallback(
    (block: Block, startRow: number, startCol: number): boolean => {
      for (let row = 0; row < block.shape.length; row++) {
        for (let col = 0; col < block.shape[row].length; col++) {
          if (block.shape[row][col] === 1) {
            const gridRow = startRow + row
            const gridCol = startCol + col
            if (gridRow < 0 || gridRow >= 8 || gridCol < 0 || gridCol >= 8 || grid[gridRow][gridCol].filled) {
              return false
            }
          }
        }
      }
      return true
    },
    [grid],
  )

  // Activate power block effects
  const activatePowerBlock = useCallback(
    (powerType: PowerBlockType, row: number, col: number, newGrid: GridCell[][]) => {
      const clearedCells: { row: number; col: number }[] = []

      switch (powerType) {
        case "bomb":
          // Clear 3x3 area around the power block
          for (let r = Math.max(0, row - 1); r <= Math.min(7, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
              if (newGrid[r][c].filled) {
                newGrid[r][c] = { filled: false, color: "", powerType: null }
                clearedCells.push({ row: r, col: c })
              }
            }
          }
          break

        case "lightning":
          // Clear entire row and column
          for (let c = 0; c < 8; c++) {
            if (newGrid[row][c].filled) {
              newGrid[row][c] = { filled: false, color: "", powerType: null }
              clearedCells.push({ row, col: c })
            }
          }
          for (let r = 0; r < 8; r++) {
            if (newGrid[r][col].filled) {
              newGrid[r][col] = { filled: false, color: "", powerType: null }
              clearedCells.push({ row: r, col })
            }
          }
          break

        case "rainbow":
          // Clear all blocks of the same color as adjacent blocks
          const targetColor = newGrid[row][col]?.color
          if (targetColor) {
            for (let r = 0; r < 8; r++) {
              for (let c = 0; c < 8; c++) {
                if (newGrid[r][c].filled && newGrid[r][c].color === targetColor) {
                  newGrid[r][c] = { filled: false, color: "", powerType: null }
                  clearedCells.push({ row: r, col: c })
                }
              }
            }
          }
          break

        case "drill":
          // Clear vertical line
          for (let r = 0; r < 8; r++) {
            if (newGrid[r][col].filled) {
              newGrid[r][col] = { filled: false, color: "", powerType: null }
              clearedCells.push({ row: r, col })
            }
          }
          break
      }

      // Create particle effects
      if (clearedCells.length > 0) {
        const newParticles = clearedCells.map((cell, index) => ({
          id: `particle-${Date.now()}-${index}`,
          x: cell.col * 30 + 15,
          y: cell.row * 30 + 15,
          color: "text-yellow-400",
        }))
        setParticles((prev) => [...prev, ...newParticles])

        // Remove particles after animation
        setTimeout(() => {
          setParticles((prev) => prev.filter((p) => !newParticles.some((np) => np.id === p.id)))
        }, 1000)
      }

      return clearedCells.length
    },
    [],
  )

  // Place block on grid
  const placeBlock = useCallback(
    (block: Block, startRow: number, startCol: number) => {
      const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })))
      const powerBlocksPlaced: { row: number; col: number; powerType: PowerBlockType }[] = []

      for (let row = 0; row < block.shape.length; row++) {
        for (let col = 0; col < block.shape[row].length; col++) {
          if (block.shape[row][col] === 1) {
            const gridRow = startRow + row
            const gridCol = startCol + col
            newGrid[gridRow][gridCol] = {
              filled: true,
              color: block.color,
              powerType: block.powerType,
            }

            if (block.powerType) {
              powerBlocksPlaced.push({ row: gridRow, col: gridCol, powerType: block.powerType })
            }
          }
        }
      }

      setGrid(newGrid)
      setCurrentBlocks((prev) => prev.filter((b) => b.id !== block.id))

      // Activate power blocks immediately after placement
      let totalPowerClears = 0
      for (const powerBlock of powerBlocksPlaced) {
        totalPowerClears += activatePowerBlock(powerBlock.powerType, powerBlock.row, powerBlock.col, newGrid)
      }

      // Check for line clears
      setTimeout(() => checkAndClearLines(newGrid), powerBlocksPlaced.length > 0 ? 500 : 100)
    },
    [grid, activatePowerBlock],
  )

  // Check and clear complete lines with enhanced animations
  const checkAndClearLines = useCallback(
    (currentGrid: GridCell[][]) => {
      const linesToClear: number[] = []
      const colsToClear: number[] = []

      // Check rows
      for (let row = 0; row < 8; row++) {
        if (currentGrid[row].every((cell) => cell.filled)) {
          linesToClear.push(row)
        }
      }

      // Check columns
      for (let col = 0; col < 8; col++) {
        if (currentGrid.every((row) => row[col].filled)) {
          colsToClear.push(col)
        }
      }

      if (linesToClear.length > 0 || colsToClear.length > 0) {
        const newGrid = currentGrid.map((row) => row.map((cell) => ({ ...cell })))

        // Clear rows
        linesToClear.forEach((row) => {
          for (let col = 0; col < 8; col++) {
            newGrid[row][col] = { filled: false, color: "", powerType: null }
          }
        })

        // Clear columns
        colsToClear.forEach((col) => {
          for (let row = 0; row < 8; row++) {
            newGrid[row][col] = { filled: false, color: "", powerType: null }
          }
        })

        const totalCleared = linesToClear.length + colsToClear.length
        const newCombo = combo + 1
        const points = totalCleared * 100 * (newCombo > 1 ? newCombo : 1)

        // Trigger screen shake for combos
        if (newCombo > 1) {
          setIsShaking(true)
          setTimeout(() => setIsShaking(false), 500)
        }

        // Show score popup
        if (gridRef.current) {
          const rect = gridRef.current.getBoundingClientRect()
          setScorePopup({
            points,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          })
          setTimeout(() => setScorePopup(null), 2000)
        }

        setGrid(newGrid)
        setScore((prev) => prev + points)
        setClearedLines((prev) => prev + totalCleared)
        setCombo(newCombo)

        // Check for more lines after clearing
        setTimeout(() => checkAndClearLines(newGrid), 200)
      } else {
        setCombo(0)
      }
    },
    [combo],
  )

  // Check if any current block can be placed
  const checkGameOver = useCallback(() => {
    for (const block of currentBlocks) {
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          if (canPlaceBlock(block, row, col)) {
            return false
          }
        }
      }
    }
    return true
  }, [currentBlocks, canPlaceBlock])

  // Generate new blocks when all are used
  useEffect(() => {
    if (currentBlocks.length === 0 && !gameOver) {
      setTimeout(() => {
        setCurrentBlocks(generateBlocks())
      }, 500)
    }
  }, [currentBlocks, gameOver, generateBlocks])

  // Check for game over
  useEffect(() => {
    if (currentBlocks.length > 0 && checkGameOver()) {
      setGameOver(true)
    }
  }, [currentBlocks, checkGameOver])

  // Handle drag start
  const handleDragStart = (block: Block) => {
    setDraggedBlock(block)
  }

  // Perfect hover handling with smooth snapping
  const handleCellHover = (row: number, col: number) => {
    if (draggedBlock) {
      setHoveredCell({ row, col })
      const canPlace = canPlaceBlock(draggedBlock, row, col)
      setIsValidPlacement(canPlace)
      setPreviewPosition({ row, col })
    }
  }

  // Handle mouse leave from grid
  const handleGridLeave = () => {
    if (draggedBlock) {
      setHoveredCell(null)
      setPreviewPosition(null)
      setIsValidPlacement(false)
    }
  }

  // Drag over handler
  const handleDragOver = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault()
    if (!hoveredCell || hoveredCell.row !== row || hoveredCell.col !== col) {
      handleCellHover(row, col)
    }
  }

  // Drop handler
  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault()
    if (draggedBlock && canPlaceBlock(draggedBlock, row, col)) {
      placeBlock(draggedBlock, row, col)
    }
    setDraggedBlock(null)
    setPreviewPosition(null)
    setHoveredCell(null)
    setIsValidPlacement(false)
  }

  // Drag end handler
  const handleDragEnd = () => {
    setDraggedBlock(null)
    setPreviewPosition(null)
    setHoveredCell(null)
    setIsValidPlacement(false)
  }

  // Reset game
  const resetGame = () => {
    setGrid(
      Array(8)
        .fill(null)
        .map(() =>
          Array(8)
            .fill(null)
            .map(() => ({ filled: false, color: "", powerType: null })),
        ),
    )
    setCurrentBlocks(generateBlocks())
    setScore(0)
    setClearedLines(0)
    setCombo(0)
    setGameOver(false)
    setIsPaused(false)
    setParticles([])
    setScorePopup(null)
  }

  // Enhanced block preview with perfect alignment
  const renderBlockPreview = (row: number, col: number) => {
    if (!draggedBlock || !previewPosition || previewPosition.row !== row || previewPosition.col !== col) {
      return null
    }

    return draggedBlock.shape.map((shapeRow, shapeRowIndex) =>
      shapeRow.map((cell, shapeCellIndex) => {
        if (cell === 1) {
          const previewRow = row + shapeRowIndex
          const previewCol = col + shapeCellIndex

          if (previewRow >= 0 && previewRow < 8 && previewCol >= 0 && previewCol < 8) {
            return (
              <div
                key={`preview-${previewRow}-${previewCol}`}
                className={`absolute w-7 h-7 rounded-lg border-2 transition-all duration-150 ${
                  isValidPlacement
                    ? `${draggedBlock.color} opacity-80 border-white/70 shadow-lg shadow-cyan-500/50`
                    : "bg-red-500 opacity-60 border-red-300/80 shadow-lg shadow-red-500/50"
                }`}
                style={{
                  top: `${previewRow * 30 + 2}px`,
                  left: `${previewCol * 30 + 2}px`,
                  zIndex: 10,
                }}
              />
            )
          }
        }
        return null
      }),
    )
  }

  // Get power block icon
  const getPowerBlockIcon = (powerType: PowerBlockType) => {
    switch (powerType) {
      case "bomb":
        return <Bomb className="w-3 h-3 text-white" />
      case "lightning":
        return <Zap className="w-3 h-3 text-white" />
      case "rainbow":
        return <Sparkles className="w-3 h-3 text-white" />
      case "drill":
        return <Target className="w-3 h-3 text-white" />
      default:
        return null
    }
  }

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 p-4 transition-all duration-300 ${isShaking ? "animate-pulse" : ""}`}
    >
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-white">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
              NEON BLAST
            </h1>
            <div className="flex gap-4 text-sm">
              <span className="text-cyan-300">Score: {score.toLocaleString()}</span>
              <span className="text-pink-300">Lines: {clearedLines}</span>
              {combo > 1 && (
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold animate-bounce">
                  COMBO x{combo}!
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsPaused(!isPaused)}
              className="bg-cyan-500/20 border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/30 hover:border-cyan-300"
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={resetGame}
              className="bg-pink-500/20 border-pink-400/50 text-pink-300 hover:bg-pink-500/30 hover:border-pink-300"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Game Grid */}
        <Card className="p-4 mb-4 bg-black/40 border-cyan-500/30 shadow-2xl shadow-cyan-500/20">
          <div
            ref={gridRef}
            className="relative w-64 h-64 mx-auto bg-gray-900/80 rounded-xl p-1 border border-purple-500/30"
            onMouseLeave={handleGridLeave}
          >
            <div className="grid grid-cols-8 gap-0.5 h-full">
              {grid.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`w-7 h-7 rounded-lg border transition-all duration-200 relative ${
                      cell.filled
                        ? `${cell.color} border-white/30 shadow-lg ${cell.powerType ? "animate-pulse shadow-yellow-400/50" : ""}`
                        : `bg-gray-800/50 border-gray-600/30 ${
                            draggedBlock && hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex
                              ? isValidPlacement
                                ? "border-cyan-400 bg-cyan-900/30 shadow-lg shadow-cyan-400/50"
                                : "border-red-400 bg-red-900/30 shadow-lg shadow-red-400/50"
                              : "hover:border-gray-500/50 hover:bg-gray-700/30"
                          }`
                    }`}
                    onMouseEnter={() => handleCellHover(rowIndex, colIndex)}
                    onDragOver={(e) => handleDragOver(e, rowIndex, colIndex)}
                    onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                  >
                    {cell.powerType && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {getPowerBlockIcon(cell.powerType)}
                      </div>
                    )}
                  </div>
                )),
              )}
            </div>

            {/* Preview rendering */}
            <div className="absolute top-1 left-1 pointer-events-none">
              {previewPosition && renderBlockPreview(previewPosition.row, previewPosition.col)}
            </div>

            {/* Particle effects */}
            {particles.map((particle) => (
              <div
                key={particle.id}
                className={`absolute w-2 h-2 ${particle.color} rounded-full animate-ping pointer-events-none`}
                style={{
                  top: `${particle.y}px`,
                  left: `${particle.x}px`,
                  zIndex: 20,
                }}
              />
            ))}
          </div>
        </Card>

        {/* Current Blocks */}
        <Card className="p-4 bg-black/40 border-pink-500/30 shadow-2xl shadow-pink-500/20">
          <h3 className="text-white font-semibold mb-3 text-center bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            POWER PIECES
          </h3>
          <div className="flex justify-center gap-4">
            {currentBlocks.map((block) => (
              <div
                key={block.id}
                className={`cursor-move p-3 bg-gray-900/60 rounded-xl border-2 transition-all duration-300 relative ${
                  draggedBlock?.id === block.id
                    ? "border-cyan-400/70 scale-110 shadow-2xl shadow-cyan-400/50"
                    : block.powerType
                      ? "border-yellow-400/50 hover:border-yellow-400/70 shadow-lg shadow-yellow-400/30"
                      : "border-gray-600/30 hover:border-gray-500/50"
                }`}
                draggable
                onDragStart={() => handleDragStart(block)}
                onDragEnd={handleDragEnd}
              >
                {block.powerType && (
                  <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1">
                    {getPowerBlockIcon(block.powerType)}
                  </div>
                )}
                <div
                  className="grid gap-0.5"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(...block.shape.map((row) => row.length))}, 1fr)`,
                  }}
                >
                  {block.shape.map((row, rowIndex) =>
                    row.map((cell, colIndex) => (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={`w-4 h-4 rounded-md transition-all duration-200 ${
                          cell === 1
                            ? `${block.color} ${block.powerType ? "shadow-lg shadow-yellow-400/50" : "shadow-md"}`
                            : "transparent"
                        }`}
                      />
                    )),
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Score Popup */}
        {scorePopup && (
          <div
            className="fixed pointer-events-none z-50 animate-bounce"
            style={{
              left: `${scorePopup.x}px`,
              top: `${scorePopup.y}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              +{scorePopup.points}
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {gameOver && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <Card className="p-6 bg-gradient-to-br from-gray-900 to-purple-900 border-cyan-500/50 text-center max-w-sm w-full">
              <Trophy className="h-16 w-16 text-yellow-400 mx-auto mb-4 animate-bounce" />
              <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
                GAME OVER!
              </h2>
              <p className="text-gray-300 mb-4">
                <span className="text-cyan-300">Final Score: {score.toLocaleString()}</span>
                <br />
                <span className="text-pink-300">Lines Cleared: {clearedLines}</span>
              </p>
              <Button
                onClick={resetGame}
                className="w-full bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white font-bold"
              >
                PLAY AGAIN
              </Button>
            </Card>
          </div>
        )}

        {/* Pause Overlay */}
        {isPaused && !gameOver && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-40">
            <Card className="p-6 bg-gradient-to-br from-gray-900 to-purple-900 border-cyan-500/50 text-center">
              <Pause className="h-16 w-16 text-cyan-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4 text-white">PAUSED</h2>
              <Button
                onClick={() => setIsPaused(false)}
                className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white font-bold"
              >
                RESUME
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
