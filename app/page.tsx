"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Pause, Play, RotateCcw, Trophy } from "lucide-react"

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

type Block = {
  id: string
  shape: number[][]
  color: string
}

type GridCell = {
  filled: boolean
  color: string
  isAnimating?: boolean
}

export default function BlockBlastGame() {
  const [grid, setGrid] = useState<GridCell[][]>(() =>
    Array(8)
      .fill(null)
      .map(() =>
        Array(8)
          .fill(null)
          .map(() => ({ filled: false, color: "" })),
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
  const [placedBlocks, setPlacedBlocks] = useState<Set<string>>(new Set())

  const gridRef = useRef<HTMLDivElement>(null)

  // Generate random blocks (removed power block logic)
  const generateBlocks = useCallback((): Block[] => {
    return Array(3)
      .fill(null)
      .map((_, index) => {
        const shape = BLOCK_SHAPES[Math.floor(Math.random() * BLOCK_SHAPES.length)]
        const color = COLORS[Math.floor(Math.random() * COLORS.length)]

        return {
          id: `block-${Date.now()}-${index}`,
          shape,
          color,
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

  // Place block on grid with animation
  const placeBlock = useCallback(
    (block: Block, startRow: number, startCol: number) => {
      const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })))
      const newPlacedBlocks = new Set<string>()

      for (let row = 0; row < block.shape.length; row++) {
        for (let col = 0; col < block.shape[row].length; col++) {
          if (block.shape[row][col] === 1) {
            const gridRow = startRow + row
            const gridCol = startCol + col
            newGrid[gridRow][gridCol] = {
              filled: true,
              color: block.color,
              isAnimating: true,
            }
            newPlacedBlocks.add(`${gridRow}-${gridCol}`)
          }
        }
      }

      setGrid(newGrid)
      setPlacedBlocks(newPlacedBlocks)
      setCurrentBlocks((prev) => prev.filter((b) => b.id !== block.id))

      // Remove animation after delay
      setTimeout(() => {
        setGrid((prevGrid) => prevGrid.map((row) => row.map((cell) => ({ ...cell, isAnimating: false }))))
        setPlacedBlocks(new Set())
      }, 300)

      // Check for line clears
      setTimeout(() => checkAndClearLines(newGrid), 400)
    },
    [grid],
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
        // Mark cells for clearing animation
        const newGrid = currentGrid.map((row) => row.map((cell) => ({ ...cell })))

        linesToClear.forEach((row) => {
          for (let col = 0; col < 8; col++) {
            newGrid[row][col].isAnimating = true
          }
        })

        colsToClear.forEach((col) => {
          for (let row = 0; row < 8; row++) {
            newGrid[row][col].isAnimating = true
          }
        })

        setGrid(newGrid)

        // Clear after animation
        setTimeout(() => {
          const clearedGrid = newGrid.map((row) => row.map((cell) => ({ ...cell })))

          linesToClear.forEach((row) => {
            for (let col = 0; col < 8; col++) {
              clearedGrid[row][col] = { filled: false, color: "" }
            }
          })

          colsToClear.forEach((col) => {
            for (let row = 0; row < 8; row++) {
              clearedGrid[row][col] = { filled: false, color: "" }
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

          // Create particles
          const newParticles = []
          linesToClear.forEach((row) => {
            for (let col = 0; col < 8; col++) {
              newParticles.push({
                id: `particle-${Date.now()}-${row}-${col}`,
                x: col * 46 + 23,
                y: row * 46 + 23,
                color: "text-yellow-400",
              })
            }
          })
          colsToClear.forEach((col) => {
            for (let row = 0; row < 8; row++) {
              newParticles.push({
                id: `particle-${Date.now()}-${row}-${col}`,
                x: col * 46 + 23,
                y: row * 46 + 23,
                color: "text-pink-400",
              })
            }
          })

          setParticles((prev) => [...prev, ...newParticles])
          setTimeout(() => {
            setParticles((prev) => prev.filter((p) => !newParticles.some((np) => np.id === p.id)))
          }, 1000)

          setGrid(clearedGrid)
          setScore((prev) => prev + points)
          setClearedLines((prev) => prev + totalCleared)
          setCombo(newCombo)

          // Check for more lines after clearing
          setTimeout(() => checkAndClearLines(clearedGrid), 200)
        }, 500)
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
            .map(() => ({ filled: false, color: "" })),
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
    setPlacedBlocks(new Set())
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
                className={`absolute w-11 h-11 border-2 transition-all duration-150 ${
                  isValidPlacement
                    ? `${draggedBlock.color} opacity-80 border-white/70 shadow-lg shadow-cyan-500/50`
                    : "bg-red-500 opacity-60 border-red-300/80 shadow-lg shadow-red-500/50"
                }`}
                style={{
                  top: `${previewRow * 46 + 2}px`,
                  left: `${previewCol * 46 + 2}px`,
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

  return (
    <div
      className={`min-h-screen relative overflow-hidden transition-all duration-300 ${isShaking ? "animate-pulse" : ""}`}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900/20 via-transparent to-yellow-900/20"></div>

        {/* Floating geometric shapes */}
        <div
          className="absolute top-10 left-10 w-20 h-20 bg-cyan-400/10 animate-bounce"
          style={{ animationDelay: "0s", animationDuration: "3s" }}
        ></div>
        <div
          className="absolute top-32 right-16 w-16 h-16 bg-pink-400/10 animate-bounce"
          style={{ animationDelay: "1s", animationDuration: "4s" }}
        ></div>
        <div
          className="absolute bottom-20 left-20 w-24 h-24 bg-yellow-400/10 animate-bounce"
          style={{ animationDelay: "2s", animationDuration: "5s" }}
        ></div>
        <div
          className="absolute bottom-32 right-32 w-12 h-12 bg-green-400/10 animate-bounce"
          style={{ animationDelay: "0.5s", animationDuration: "3.5s" }}
        ></div>

        {/* Moving gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 animate-pulse"></div>
        <div
          className="absolute top-3/4 right-1/4 w-40 h-40 bg-gradient-to-r from-pink-500/20 to-purple-500/20 animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      <div className="relative z-10 p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="text-white">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
                BLOCK BLAST
              </h1>
              <div className="flex gap-6 text-lg mt-2">
                <span className="text-cyan-300">Score: {score.toLocaleString()}</span>
                <span className="text-pink-300">Lines: {clearedLines}</span>
                {combo > 1 && (
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold animate-bounce text-lg px-3 py-1">
                    COMBO x{combo}!
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setIsPaused(!isPaused)}
                className="bg-cyan-500/20 border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/30 hover:border-cyan-300"
              >
                {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={resetGame}
                className="bg-pink-500/20 border-pink-400/50 text-pink-300 hover:bg-pink-500/30 hover:border-pink-300"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Game Grid - Much Larger */}
          <Card className="p-6 mb-6 bg-black/40 border-cyan-500/30 shadow-2xl shadow-cyan-500/20">
            <div
              ref={gridRef}
              className="relative w-96 h-96 mx-auto bg-gray-900/80 border border-purple-500/30"
              onMouseLeave={handleGridLeave}
            >
              <div className="grid grid-cols-8 gap-0.5 h-full p-1">
                {grid.map((row, rowIndex) =>
                  row.map((cell, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-11 h-11 border transition-all duration-300 relative ${
                        cell.filled
                          ? `${cell.color} border-white/30 shadow-lg ${
                              cell.isAnimating ? "animate-pulse scale-110" : ""
                            } ${placedBlocks.has(`${rowIndex}-${colIndex}`) ? "animate-bounce" : ""}`
                          : `bg-gray-800/50 border-gray-600/30 ${
                              draggedBlock && hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex
                                ? isValidPlacement
                                  ? "border-cyan-400 bg-cyan-900/30 shadow-lg shadow-cyan-400/50 scale-105"
                                  : "border-red-400 bg-red-900/30 shadow-lg shadow-red-400/50"
                                : "hover:border-gray-500/50 hover:bg-gray-700/30 hover:scale-105"
                            }`
                      }`}
                      onMouseEnter={() => handleCellHover(rowIndex, colIndex)}
                      onDragOver={(e) => handleDragOver(e, rowIndex, colIndex)}
                      onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                    />
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
                  className={`absolute w-3 h-3 ${particle.color} animate-ping pointer-events-none`}
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
          <Card className="p-6 bg-black/40 border-pink-500/30 shadow-2xl shadow-pink-500/20">
            <h3 className="text-white font-semibold mb-4 text-center bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent text-xl">
              NEXT PIECES
            </h3>
            <div className="flex justify-center gap-6">
              {currentBlocks.map((block) => (
                <div
                  key={block.id}
                  className={`cursor-move p-4 bg-gray-900/60 border-2 transition-all duration-300 hover:scale-110 ${
                    draggedBlock?.id === block.id
                      ? "border-cyan-400/70 scale-125 shadow-2xl shadow-cyan-400/50 opacity-50"
                      : "border-gray-600/30 hover:border-gray-500/50"
                  }`}
                  draggable
                  onDragStart={() => handleDragStart(block)}
                  onDragEnd={handleDragEnd}
                >
                  <div
                    className="grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(...block.shape.map((row) => row.length))}, 1fr)`,
                    }}
                  >
                    {block.shape.map((row, rowIndex) =>
                      row.map((cell, colIndex) => (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={`w-6 h-6 transition-all duration-200 ${
                            cell === 1 ? `${block.color} shadow-md` : "transparent"
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
              <div className="text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                +{scorePopup.points}
              </div>
            </div>
          )}

          {/* Game Over Modal */}
          {gameOver && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
              <Card className="p-8 bg-gradient-to-br from-gray-900 to-purple-900 border-cyan-500/50 text-center max-w-md w-full">
                <Trophy className="h-20 w-20 text-yellow-400 mx-auto mb-6 animate-bounce" />
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
                  GAME OVER!
                </h2>
                <p className="text-gray-300 mb-6 text-lg">
                  <span className="text-cyan-300">Final Score: {score.toLocaleString()}</span>
                  <br />
                  <span className="text-pink-300">Lines Cleared: {clearedLines}</span>
                </p>
                <Button
                  onClick={resetGame}
                  size="lg"
                  className="w-full bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white font-bold text-lg py-3"
                >
                  PLAY AGAIN
                </Button>
              </Card>
            </div>
          )}

          {/* Pause Overlay */}
          {isPaused && !gameOver && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-40">
              <Card className="p-8 bg-gradient-to-br from-gray-900 to-purple-900 border-cyan-500/50 text-center">
                <Pause className="h-20 w-20 text-cyan-400 mx-auto mb-6" />
                <h2 className="text-3xl font-bold mb-6 text-white">PAUSED</h2>
                <Button
                  onClick={() => setIsPaused(false)}
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white font-bold text-lg py-3 px-8"
                >
                  RESUME
                </Button>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
