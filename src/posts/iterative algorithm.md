---
title: 迭代算法学习
date: 2026-07-22
tags: [pplab]
summary: 对于迭代算法程序推演的详细理解
---

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=MWU1ZTgxY2NiNDc1ZDBjOGZhOWViYWY2ZmFjYmU2YWFfYzM0ZjQ0MTNkZjQ4NjQ0MDFkNmZjMzk3MjMyNzNjYzVfSUQ6NzY1OTc4OTUwMzExNjM0ODM5Nl8xNzkxNzk5MDk0OjE3OTE4ODU0OTRfVjM)

当前存在的问题：

1. 存在导线电阻与开关电阻

2. 串扰问题

# 一、初始化

## 1、电路参数

$R_f$ ：反馈电阻  $R_T$ ：横向导电条电阻  $R_B$ ：纵向导电条电阻  $R_{switch}$：开关电阻  $V_{source}$：电源电压

## 2、矩阵初始化

$I_T
$：横向电流  $I_B$：纵向电流  $I_R$：待测电阻电流  $V_T$：待测电阻上端电压  $V_B$：待测电阻下端电压

1. 电阻初始化：$R=\frac{V_{source}*R_f}{V_{read}}$，$V_{read}$为读出电压

2. 外层循环遍历每一行（ x 行）bcd

    1. $I_B=I_T=0$

    2. $I_B=\frac{V_{read}+V_{offset}}{R_f}$（从x行开始的以下所有行所有列）反向偏移

    3. $I_T[x, j] = I_T[x, j + 1] + I_B[x, j]$，最右边$ I_T[x, j] = I_B[x, j]$

    4. 保存当前行x的初始电流状态，存入`iteration_states`，作为第一轮迭代起点

# 二、主迭代循环（左边、下边角标相同）

## 1、整体流程

循环控制：最大迭代次数`max_iterations`，收敛阈值`tolerance`。

每一轮完整迭代逻辑：

1. 保存上一轮全部电阻`prev_R = R.copy()`，用于收敛判断

2. 新建空容器`step_states`存储本轮每行激励后的电流电压状态

3. 逐行遍历激励行x

4. 对当前激励行x，取出上一轮该行保存的$I_T、I_B、V_T、V_B$

5. 分步更新电位、电阻、支路电流

6. 全部行计算完成后，覆盖迭代状态，判断收敛

## 2、对于激励行，计算电位，更新电阻

对于每一列 j：

1. 计算上端电位$V_T[x,j]$：

    1. 第一列：电源\-开关\-导电条：$V_T[x, 0] = V_{source} - I_T[x, 0] \times (R_T + R_{switch})$

    2. 其他列：上个点\-导电条\-下个点：$V_T[x, j] = V_T[x, j - 1] - I_T[x, j] \times R_T$

2. 计算下端电位$V_B[i,j]$，对于该列的从下往上的每一行：

    1. 最后一行：零电位\-偏置电压\-导电条：$V_B[rows-1,j] = V_{offset}[x,j] + I_B[rows-1,j] \cdot R_B$

    2. 其他行：$V_B[i, j] = V_B[i + 1, j] + I_B[i, j] \times R_B$

3. 流经电阻的电流：$I_R[x,j] = \begin{cases} I_B[x,j] & x=0 \\ I_B[x,j] - I_B[x-1,j] & x>0 \end{cases}$

4. 利用欧姆定律得到更新的电阻：$R[x, j] = \frac{V_T[x, j] - V_B[x, j]}{  I_R[x, j]}$

## 3、 对于其他行，更新电流

除当前激励行x以外的所有行$i≠x$：

1. 非激励行无电源驱动，同样计算横向压降

首列：$V_T[x, 0] = 0 - I_T[x, 0] \times (R_T + R_{switch})$

其他列：$V_T[x, j] = V_T[x, j - 1] - I_T[x, j] \times R_T$

2. 纵向电位$V_B[i,j]$计算规则和激励行完全一致；

3. 用上一轮迭代的旧电阻 `prev_R` 反推当前电阻电流： $I_R[i,j] = \frac{V_T[i,j] - V_B[i,j]}{prev_R[i,j]}$

## 4、整体修正纵向电流$I_B$

![Image](https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/authcode/?code=NjZhYjJhMjY2MjMyY2YzOWJjYjJhNTFlYTIyMGNiMGVfOGNjMmYxMzYwZTJlNjA4NzQ2YTYxNTk4Y2JjZmJmNjBfSUQ6NzY1OTgwNDM4NjkxMDU1NTMzN18xNzkxNzk5MDk0OjE3OTE4ODU0OTRfVjM)

根据更新后的$I_R$，重新计算每根竖线上的电流，分三段更新：

1. x 行下方所有行（从底向上） 最底部竖线电流固定由运放读数决定；

上方行电流 = 下一行电流 \- 下一行电阻分流： $I_{Bnew}[i,j] = I_{Bnew}[i+1,j] - I_R[i+1,j]$

2. x 行上方所有行（从上向下） 第一行无上层电流，电流等于自身电阻分流；

下方行叠加上层电阻分流： $I_{Bnew}[i,j] = I_{Bnew}[i-1,j] + I_R[i,j]$

3. 当前激励行 x 用下方一行更新后的竖线电流减去该行电阻分流得到本行竖线电流。

## 5、整体修正横向电流$I_T$

横向电流满足电流守恒：右侧所有电阻的分流都要从左侧横线流过。 从最右列向左遍历：

$I_{Tnew}[i,j] = \begin{cases} I_R[i,j] & j=cols-1 \\ I_T{new}[i,j+1] + I_R[i,j] & j<cols-1 \end{cases}$

## 6、保存状态，一轮迭代结束

将更新完成的$I_{Tnew},I_{Bnew}$赋值给主变量$I_T,I_B$；

保存当前激励行x的全部电流电压状态；

全部列、全部行循环完成后，用本轮`step_states`覆盖全局`iteration_states`，作为下一轮迭代初始值；

收敛判断： 

```Python
np.allclose(R, prev_R, atol=tolerance)
```

全部位置电阻变化绝对值都小于容差`tolerance`，迭代终止；否则进入下一轮循环。

# 三、整体思想

先用当前猜测的电阻，算出真实导线电位与支路电流；再用修正后的电位、电流反向更新电阻，循环直到电阻不再变化