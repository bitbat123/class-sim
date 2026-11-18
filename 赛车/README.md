# 赛车程序大赛

随机生成赛道（固定种子），两辆车按程序给出的油门与转向跑完全程。

## 运行

`ash
npm install
npm run web:dev      # http://127.0.0.1:5183
npm run web:build
npm test             # 引擎测试（15 项）
`

## 方言（car.h）

| 差异 | 说明 |
|---|---|
| 头文件 | 必须 #include<car.h> |
| 可写变量 | **只有** car::throttle（0–100）和 car::steer（-100 左 到 100 右） |
| 只读变量 | my_x、my_y、my_speed、my_progress、opp_progress、	rack_width、center_offset、off_track、	ick |
| 函数 | car::center_ahead(d)、car::boundary_ahead(d)、car::distance_to_center()、car::abs/max/min |

## 物理（简化街机模型）

- 油门加速、阻力减速，最高速度 26/帧；
- 转向随速度增强，出界后减速且转向变弱；
- 偏离中心线超过半个赛道宽即出界；
- 先冲线者胜；超时按进度判定。

## 基准程序

- 稳：低速直行
- 中：全油门 + 前方中心线修正
- 快：预判更远 + 连续修正 + 出界收油

## 部署

发布在 https://bitbat123.github.io/class-sim/racing/
