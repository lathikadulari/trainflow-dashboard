import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, LineChart, Line, ReferenceLine } from 'recharts';

export const MLAnalysis: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [generateMsg, setGenerateMsg] = useState('');
  
  const [modelData, setModelData] = useState<any>(null);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setGenerateMsg('Generating dataset (applying Bandpass & Envelopes)...');
    try {
      const res = await fetch('http://localhost:5000/api/ml/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensorId: 'sensor2' })
      });
      const data = await res.json();
      setGenerateMsg(data.message || 'Dataset generated.');
    } catch (e: any) {
      setGenerateMsg('Error: ' + e.message);
    }
    setLoading(false);
  };

  const handleTrain = async () => {
    setLoading(true);
    setGenerateMsg('Training Logistic Regression Model...');
    try {
      const res = await fetch('http://localhost:5000/api/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensorId: 'sensor2' })
      });
      const data = await res.json();
      if (data.success) {
        setModelData(data);
        setGenerateMsg('Training complete.');
      } else {
        setGenerateMsg('Error: ' + data.message);
      }
    } catch (e: any) {
      setGenerateMsg('Error: ' + e.message);
    }
    setLoading(false);
  };

  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;

  // Prepare Scatter Data
  const idleData = modelData?.dataPoints.filter((d: any) => d.label === 0) || [];
  const approachData = modelData?.dataPoints.filter((d: any) => d.label === 1) || [];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            AI Early Warning Model (Bandpass: 1.8Hz - 3.5Hz)
          </h1>
          <p className="text-slate-500 text-sm mt-1">Train a logistic regression model on energy envelopes to detect distant trains.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleGenerate} disabled={loading} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm font-medium transition-colors border border-slate-700">
            1. Generate Dataset
          </button>
          <button onClick={handleTrain} disabled={loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20">
            2. Train Model
          </button>
        </div>
      </div>

      {generateMsg && (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded text-sm text-slate-400 flex items-center gap-2">
          {loading && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
          {generateMsg}
        </div>
      )}

      {modelData && (
        <>
          {/* METRICS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-900/60 border-slate-800/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400">Training Metrics (80%)</CardTitle></CardHeader>
              <CardContent className="flex gap-6">
                <div><div className="text-xs text-slate-500 uppercase">Accuracy</div><div className="text-xl font-bold text-emerald-400">{formatPercent(modelData.trainMetrics.accuracy)}</div></div>
                <div><div className="text-xs text-slate-500 uppercase">Precision</div><div className="text-xl font-bold text-blue-400">{formatPercent(modelData.trainMetrics.precision)}</div></div>
                <div><div className="text-xs text-slate-500 uppercase">Recall</div><div className="text-xl font-bold text-purple-400">{formatPercent(modelData.trainMetrics.recall)}</div></div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/60 border-slate-800/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-400">Validation Metrics (20%)</CardTitle></CardHeader>
              <CardContent className="flex gap-6">
                {modelData.testMetrics ? (
                  <>
                    <div><div className="text-xs text-slate-500 uppercase">Accuracy</div><div className="text-xl font-bold text-emerald-400">{formatPercent(modelData.testMetrics.accuracy)}</div></div>
                    <div><div className="text-xs text-slate-500 uppercase">Precision</div><div className="text-xl font-bold text-blue-400">{formatPercent(modelData.testMetrics.precision)}</div></div>
                    <div><div className="text-xs text-slate-500 uppercase">Recall</div><div className="text-xl font-bold text-purple-400">{formatPercent(modelData.testMetrics.recall)}</div></div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500">Not enough test data.</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* FEATURE SCATTER PLOT */}
            <Card className="col-span-2 bg-slate-900/60 border-slate-800/50">
              <CardHeader>
                <CardTitle className="text-sm text-slate-400">Feature Separability (Mean Energy vs Energy Slope)</CardTitle>
                <p className="text-xs text-slate-500">Click a point to view its exact energy envelope.</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" dataKey="meanEnergy" name="Mean Energy" stroke="#475569" fontSize={10} tickFormatter={v => v.toExponential(1)} label={{ value: 'Mean Energy (Bandpassed)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10 }} />
                    <YAxis type="number" dataKey="energySlope" name="Energy Slope" stroke="#475569" fontSize={10} tickFormatter={v => v.toExponential(1)} label={{ value: 'Energy Slope (Rate of Change)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                    <ZAxis type="number" range={[40, 40]} />
                    <RechartsTooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                      labelStyle={{ color: '#94a3b8' }}
                      formatter={(val: number) => val.toExponential(3)}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Scatter name="Idle / Background Noise" data={idleData} fill="#94a3b8" opacity={0.6} onClick={(e) => setSelectedPoint(e.payload)} />
                    <Scatter name="Train Approaching" data={approachData} fill="#ef4444" opacity={0.8} onClick={(e) => setSelectedPoint(e.payload)} />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* CONFUSION MATRIX */}
            <Card className="bg-slate-900/60 border-slate-800/50">
              <CardHeader><CardTitle className="text-sm text-slate-400">Confusion Matrix (Combined)</CardTitle></CardHeader>
              <CardContent>
                {(() => {
                   let tp=0, fp=0, tn=0, fn=0;
                   modelData.dataPoints.forEach((d:any) => {
                     const pred = d.probability >= 0.5 ? 1 : 0;
                     if (d.label===1 && pred===1) tp++;
                     if (d.label===0 && pred===1) fp++;
                     if (d.label===0 && pred===0) tn++;
                     if (d.label===1 && pred===0) fn++;
                   });
                   return (
                     <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-slate-800/50 p-4 rounded border border-slate-700/50">
                          <div className="text-slate-400 mb-1">True Negative (Correct Idle)</div>
                          <div className="text-2xl font-bold text-slate-300">{tn}</div>
                        </div>
                        <div className="bg-red-900/20 p-4 rounded border border-red-900/30">
                          <div className="text-slate-400 mb-1">False Positive (False Alarm)</div>
                          <div className="text-2xl font-bold text-red-400">{fp}</div>
                        </div>
                        <div className="bg-orange-900/20 p-4 rounded border border-orange-900/30">
                          <div className="text-slate-400 mb-1">False Negative (Missed Train)</div>
                          <div className="text-2xl font-bold text-orange-400">{fn}</div>
                        </div>
                        <div className="bg-emerald-900/20 p-4 rounded border border-emerald-900/30">
                          <div className="text-slate-400 mb-1">True Positive (Correct Train)</div>
                          <div className="text-2xl font-bold text-emerald-400">{tp}</div>
                        </div>
                     </div>
                   )
                })()}
              </CardContent>
            </Card>
          </div>

          {/* SELECTED POINT ENVELOPE */}
          {selectedPoint && (
            <Card className="bg-slate-900/60 border-slate-800/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${selectedPoint.label === 1 ? 'bg-red-500' : 'bg-slate-500'}`} />
                  Time-Series Energy Envelope ({selectedPoint.label === 1 ? 'Approaching' : 'Idle'})
                </CardTitle>
                <div className="text-xs text-slate-500">
                  AI Probability of Train: <span className={selectedPoint.probability >= 0.5 ? 'text-red-400 font-bold' : 'text-slate-300 font-bold'}>{(selectedPoint.probability * 100).toFixed(2)}%</span>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={selectedPoint.envelopeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="timeOffsetSec" stroke="#475569" fontSize={10} tickFormatter={v => `${v}s`} />
                    <YAxis stroke="#475569" fontSize={10} tickFormatter={v => v.toExponential(1)} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                      labelFormatter={v => `t = ${v}s`}
                      formatter={(val: number) => val.toExponential(3)}
                    />
                    <Line type="monotone" dataKey="energy" stroke={selectedPoint.label === 1 ? '#ef4444' : '#94a3b8'} strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

        </>
      )}
    </div>
  );
};
