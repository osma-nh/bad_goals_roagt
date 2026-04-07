// Default goals configuration
// This file can be overwritten by the Rust server with actual goals
let defaultSimulationConfigList = {
    goals: [
        {
            initial_positions: [["L",0,0],["F",-1,0]],
            targets: [[1,[["L",1,0],["F",0,0]],[],[]]],
            boundary: [-2,2,-1,1],
            wall: [null,null]
        },
        {
            initial_positions: [["F",0,0],["L",1,0]],
            targets: [[3,[["F",0,0],["R",-1,0]],[],[]]],
            boundary: [-2,3,-2,2],
            wall: [2,null]
        },
        {
            initial_positions: [["R",0,0],["F",-1,0]],
            targets: [[1,[["R",1,0],["F",0,0]],[],[]]],
            boundary: [-2,2,-1,1],
            wall: [null,null]
        },
        {
            initial_positions: [["R",0,0],["F",-1,0]],
            targets: [[3,[["F",-1,1],["L",-2,1]],[],[]]],
            boundary: [-3,2,-1,2],
            wall: [1,null]
        },
        {
            initial_positions: [["R",-1,0],["F",0,0]],
            targets: [[3,[["L",1,-1],["F",0,-1]],[],[]]],
            boundary: [-3,2,-3,1],
            wall: [-2,-2]
        },
        {
            initial_positions: [["L",0,-1],["F",-1,-1]],
            targets: [[1,[["L",1,-1],["F",0,-1]],[],[]]],
            boundary: [-2,2,-3,0],
            wall: [null,-2]
        },
        {
            initial_positions: [["L",0,-1],["F",-1,-1]],
            targets: [[3,[["R",-2,-1],["F",-1,-1]],[],[]]],
            boundary: [-3,2,-3,1],
            wall: [1,-2]
        },
        {
            initial_positions: [["F",-1,0],["R",0,0]],
            targets: [[1,[["R",1,0],["F",0,0]],[],[]]],
            boundary: [-2,2,-1,2],
            wall: [null,1]
        },
        {
            initial_positions: [["R",0,0],["F",1,0]],
            targets: [[3,[["R",0,2],["L",0,1]],[],[]]],
            boundary: [-6,6,-6,6],
            wall: [-1,-1]
        },
        {
            initial_positions: [["R",0,1],["L",-1,1]],
            targets: [[1,[["R",1,1],["L",0,1]],[],[]]],
            boundary: [-2,2,0,3],
            wall: [null,2]
        },
        {
            initial_positions: [["R",-1,1],["L",-1,0]],
            targets: [[3,[["L",1,1],["F",0,1]],[],[]]],
            boundary: [-3,2,-1,3],
            wall: [-2,2]
        },
        {
            initial_positions: [["L",0,0],["F",-1,0]],
            targets: [[1,[["L",1,0],["F",0,0]],[],[]]],
            boundary: [-2,2,-1,2],
            wall: [null,1]
        },
        {
            initial_positions: [["L",1,0],["F",0,0]],
            targets: [[3,[["R",-1,0],["R",0,0]],[],[]]],
            boundary: [-2,3,-2,2],
            wall: [2,1]
        },
        {
            initial_positions: [["R",0,0],["R",1,0]],
            targets: [[1,[["R",-1,0],["R",0,0]],[],[]]],
            boundary: [-2,2,-1,2],
            wall: [null,1]
        },
        {
            initial_positions: [["R",0,0],["R",1,0]],
            targets: [[3,[["F",0,-1],["F",0,-2]],[],[]]],
            boundary: [-2,2,-3,2],
            wall: [-1,1]
        },
        {
            initial_positions: [["F",0,1],["F",0,2]],
            targets: [[2,[["F",1,1],["L",2,1]],[],[]]],
            boundary: [-6,5,0,3],
            wall: [-1,null]
        },
    ]
};
