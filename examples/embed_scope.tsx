import { Canvas, Shape, Edge, Text, EmbedScope, MindMap, Node } from '@magam/core';

/**
 * EmbedScope Example
 *
 * Reusable component sections with isolated ID namespaces.
 * Each EmbedScope prefixes child IDs automatically,
 * preventing collisions when the same component is used multiple times.
 */

function ServiceCluster({ label, anchorId, anchorPosition }: {
    label: string;
    anchorId: string;
    anchorPosition: 'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right';
}) {
    return (
        <>
            <Shape id="lb" anchor={anchorId} position={anchorPosition} gap={80} width={120} height={50}>
                Load Balancer
            </Shape>
            <Shape id="app" anchor="lb" position="bottom" gap={60} width={120} height={50}>
                {label} Server
                <Edge to="db" label="query" />
            </Shape>
            <Shape id="db" anchor="app" position="bottom" gap={60} width={120} height={50}>
                Database
            </Shape>
            <Edge from="lb" to="app" label="route" />
        </>
    );
}

function InfraMap({ anchorId }: { anchorId: string }) {
    return (
        <>
            <Text id="map.map-seed" x={0} y={0} className="text-[1px] text-transparent select-none">.</Text>
            <MindMap id="map" anchor={anchorId} position="right" gap={200}>
                <Node id="root" from={{ node: 'map.map-seed', edge: { stroke: 'transparent', strokeWidth: 0 } }}>
                    Infrastructure
                </Node>
                <Node id="k8s" from="root">Kubernetes</Node>
                <Node id="pod1" from="k8s">Auth Pod</Node>
                <Node id="pod2" from="k8s">Billing Pod</Node>
                <Node id="monitoring" from="root">Monitoring</Node>
                <Node id="grafana" from="monitoring">Grafana</Node>
                <Node id="prometheus" from="monitoring">Prometheus</Node>
            </MindMap>
        </>
    );
}

export default function EmbedScopeExample() {
    return (
        <Canvas>
            <Text id="title" x={0} y={-200}>Microservices with EmbedScope</Text>

            {/* Gateway - only element with hardcoded position */}
            <Shape id="gateway" x={0} y={0} width={140} height={50}>
                API Gateway
                <Edge to="auth.lb" label="auth" />
                <Edge to="billing.lb" label="billing" />
            </Shape>

            {/* Auth Service - IDs become auth.lb, auth.app, auth.db */}
            <EmbedScope id="auth">
                <ServiceCluster label="Auth" anchorId="gateway" anchorPosition="bottom-left" />
            </EmbedScope>

            {/* Billing Service - IDs become billing.lb, billing.app, billing.db */}
            <EmbedScope id="billing">
                <ServiceCluster label="Billing" anchorId="gateway" anchorPosition="bottom-right" />
            </EmbedScope>

            {/* Cross-service edge using fully qualified IDs */}
            <Edge from="auth.app" to="billing.app" label="verify payment" />

            {/* MindMap inside EmbedScope - IDs become infra.map */}
            <EmbedScope id="infra">
                <InfraMap anchorId="gateway" />
            </EmbedScope>
        </Canvas>
    );
}
