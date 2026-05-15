#!/usr/bin/env python3

def fibonacci(n):
    """
    计算斐波那契数列的前n项
    """
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    elif n == 2:
        return [0, 1]
    
    fib_sequence = [0, 1]
    for i in range(2, n):
        fib_sequence.append(fib_sequence[i-1] + fib_sequence[i-2])
    
    return fib_sequence

if __name__ == "__main__":
    import sys
    import os
    
    # 从环境变量获取参数
    args = os.environ.get('SKILL_ARGS', '{}')
    import json
    try:
        params = json.loads(args)
        n = params.get('n', 10)
    except:
        n = 10
    
    # 验证输入
    try:
        n = int(n)
        if n < 0:
            print("请输入非负整数")
            sys.exit(1)
    except ValueError:
        print("请输入有效的整数")
        sys.exit(1)
    
    result = fibonacci(n)
    print(f"斐波那契数列前{n}项：")
    print(result)
    
    # 计算前1项（题目要求）
    if n >= 1:
        first_1 = fibonacci(1)