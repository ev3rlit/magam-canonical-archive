import { Users, Server, Database, Shield, Cloud, Cpu, GitBranch } from 'lucide-react';
import { Canvas, Shape, MindMap, Node, Edge, Text } from '@magam/core';

/**
 * Icons Example
 *
 * Demonstrates Lucide icons as children declarations in Shapes and MindMap nodes.
 */
export default function IconsExample() {
    return (
        <Canvas>
            {/* Left side: Architecture with Shapes */}
            <Text id="canvas-title" x={100} y={30}>Architecture (Shapes + Lucide)</Text>

            <Shape id="users" x={50} y={100}>
                <Users size={16} />
                <Text>Users</Text>
            </Shape>

            <Shape id="api" anchor="users" position="right" gap={120}>
                <Server size={16} />
                <Text>API Server</Text>
                <Edge to="users" />
            </Shape>

            <Shape id="db" anchor="api" position="right" gap={120}>
                <Database size={16} />
                <Text>Database</Text>
                <Edge to="api" />
            </Shape>

            <Shape id="auth" anchor="api" position="bottom" gap={80}>
                <Shield size={16} />
                <Text>Auth Service</Text>
                <Edge to="api" />
            </Shape>

            {/* Right side: Tech Stack MindMap */}
            <Text id="stack-map.seed" x={600} y={50} className="text-[1px] text-transparent select-none">.</Text>
            <MindMap id="stack-map" x={600} y={50} layout="tree">
                <Node id="stack" from={{ node: 'stack-map.seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    ⚡ Tech Stack
                </Node>

                <Node id="cloud" from="stack">
                    <Cloud size={14} />
                    Cloud
                </Node>
                <Node id="backend" from="stack">
                    <Cpu size={14} />
                    Backend
                </Node>
                <Node id="version" from="stack">
                    <GitBranch size={14} />
                    Git
                </Node>

                <Node id="aws" from="cloud">AWS</Node>
                <Node id="gcp" from="cloud">GCP</Node>

                <Node id="node" from="backend">Node.js</Node>
                <Node id="go" from="backend">Go</Node>
            </MindMap>
        </Canvas>
    );
}
